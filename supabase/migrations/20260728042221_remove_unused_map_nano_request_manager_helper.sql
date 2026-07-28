-- Remove the unused private helper created during the first remote deployment.
-- Commercial request authorization is fully scoped by the three user-facing RPCs.
drop function if exists private.is_map_nano_commercial_request_manager(uuid);
