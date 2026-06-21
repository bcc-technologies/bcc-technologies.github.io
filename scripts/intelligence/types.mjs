/**
 * @typedef {Object} IntelligenceQuery
 * @property {string=} text
 * @property {string[]=} keywords
 * @property {string[]=} topics
 * @property {number=} limit
 * @property {string=} fromDate
 * @property {string=} toDate
 */

/**
 * @typedef {Object} IntelligenceItem
 * @property {"paper"|"grant"|"patent"} kind
 * @property {string} sourceName
 * @property {string} sourceType
 * @property {string} externalId
 * @property {string} title
 * @property {string=} doi
 * @property {string=} arxivId
 * @property {string=} abstract
 * @property {string[]=} authors
 * @property {string[]=} institutions
 * @property {string=} publicationDate
 * @property {string=} sourceUrl
 * @property {string=} journalOrVenue
 * @property {string[]=} topics
 * @property {string[]=} keywords
 * @property {number=} citationsCount
 * @property {string=} openAccessUrl
 * @property {Record<string, any>} rawData
 */

/**
 * @typedef {Object} IntelligenceConnector
 * @property {string} sourceName
 * @property {string} sourceType
 * @property {(query: IntelligenceQuery) => Promise<IntelligenceItem[]>} search
 * @property {(id: string) => Promise<IntelligenceItem | null>=} fetchById
 */

export {};
