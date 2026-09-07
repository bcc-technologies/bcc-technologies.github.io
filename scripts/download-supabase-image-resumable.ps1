[CmdletBinding()]
param(
    [string]$Repository = 'supabase/postgres',
    [string]$ManifestDigest = 'd47ea5650400dacaa0cb2026517c95e891d2ec1dfd5f79fcfbf26b551054fa4f',
    [string]$WorkDirectory = "$env:LOCALAPPDATA\Temp\CodexSupabaseOCI",
    [int]$RetryDelaySeconds = 30
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$manifestPath = Join-Path $WorkDirectory 'manifest.json'
$blobDirectory = Join-Path $WorkDirectory 'blobs\sha256'
$curl = (Get-Command curl.exe -ErrorAction Stop).Source

if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "Manifest not found: $manifestPath"
}

$actualManifestHash = (Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash
if ($actualManifestHash -ne $ManifestDigest.ToUpperInvariant()) {
    throw "Manifest digest mismatch. Expected $ManifestDigest, got $actualManifestHash"
}

New-Item -ItemType Directory -Path $blobDirectory -Force | Out-Null

function Write-DownloadEvent {
    param([Parameter(Mandatory)][string]$Message)

    Write-Output ("{0} {1}" -f (Get-Date -Format o), $Message)
}

function Get-SignedBlobUrl {
    param([Parameter(Mandatory)][string]$Digest)

    while ($true) {
        try {
            $scope = [uri]::EscapeDataString("repository:${Repository}:pull")
            $tokenUri = "https://auth.docker.io/token?service=registry.docker.io&scope=$scope"
            $tokenResponse = Invoke-RestMethod `
                -Uri $tokenUri `
                -Headers @{ 'User-Agent' = 'Codex-Resumable-OCI' } `
                -TimeoutSec 120

            $registryUri = "https://registry-1.docker.io/v2/$Repository/blobs/sha256:$Digest"
            try {
                $null = Invoke-WebRequest `
                    -Uri $registryUri `
                    -Method Get `
                    -Headers @{
                        Authorization = 'Bearer ' + $tokenResponse.token
                        'User-Agent' = 'Codex-Resumable-OCI'
                        Range = 'bytes=0-0'
                    } `
                    -MaximumRedirection 0 `
                    -TimeoutSec 120

                throw 'Registry did not return the expected CDN redirect.'
            }
            catch {
                $location = $_.Exception.Response.Headers.Location
                if ($location) {
                    return [string]$location
                }
                throw
            }
        }
        catch {
            Write-DownloadEvent "AUTH_RETRY digest=$Digest error=$($_.Exception.Message)"
            Start-Sleep -Seconds $RetryDelaySeconds
        }
    }
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$blobs = @(
    [pscustomobject]@{
        digest = $manifest.config.digest
        size = [int64]$manifest.config.size
        kind = 'config'
    }
)
$blobs += @(
    $manifest.layers | ForEach-Object {
        [pscustomobject]@{
            digest = $_.digest
            size = [int64]$_.size
            kind = 'layer'
        }
    }
)
$blobs = $blobs | Sort-Object size -Descending

foreach ($blob in $blobs) {
    $digest = ([string]$blob.digest).Substring(7)
    $destination = Join-Path $blobDirectory $digest
    $expectedSize = [int64]$blob.size

    while ($true) {
        $currentSize = if (Test-Path -LiteralPath $destination) {
            [int64](Get-Item -LiteralPath $destination).Length
        }
        else {
            0
        }

        if ($currentSize -gt $expectedSize) {
            throw "Blob is larger than expected: $digest ($currentSize > $expectedSize)"
        }

        if ($currentSize -eq $expectedSize) {
            $actualHash = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash
            if ($actualHash -ne $digest.ToUpperInvariant()) {
                throw "Blob digest mismatch: $digest (got $actualHash)"
            }

            Write-DownloadEvent "VERIFIED kind=$($blob.kind) digest=$digest bytes=$expectedSize"
            break
        }

        try {
            $signedUrl = Get-SignedBlobUrl -Digest $digest
            Write-DownloadEvent "RESUME kind=$($blob.kind) digest=$digest bytes=$currentSize/$expectedSize"

            & $curl `
                -L `
                --fail `
                --silent `
                --show-error `
                --connect-timeout 120 `
                --retry 8 `
                --retry-all-errors `
                --retry-delay 15 `
                --continue-at - `
                --output $destination `
                $signedUrl

            $curlExitCode = $LASTEXITCODE
            $newSize = if (Test-Path -LiteralPath $destination) {
                [int64](Get-Item -LiteralPath $destination).Length
            }
            else {
                0
            }
            Write-DownloadEvent "CURL_EXIT code=$curlExitCode digest=$digest bytes=$newSize/$expectedSize"
        }
        catch {
            Write-DownloadEvent "DOWNLOAD_RETRY digest=$digest error=$($_.Exception.Message)"
        }

        Start-Sleep -Seconds $RetryDelaySeconds
    }
}

Write-DownloadEvent 'ALL_BLOBS_VERIFIED'
