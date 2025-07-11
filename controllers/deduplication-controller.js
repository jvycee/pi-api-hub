const EndpointWrapper = require('../helpers/endpoint-wrapper');

/**
 * 🍌 BANANA-POWERED DEDUPLICATION CONTROLLER 🍌
 * 
 * Handles all request deduplication and batching endpoints
 */
class DeduplicationController {
  constructor(requestDeduplicationBatcher) {
    this.requestDeduplicationBatcher = requestDeduplicationBatcher;
  }

  getStats = EndpointWrapper.createGetEndpoint(
    () => this.requestDeduplicationBatcher.getStats(),
    { errorMessage: 'Failed to get deduplication statistics' }
  );

  flushBatches = EndpointWrapper.createAdminEndpoint(
    async () => { 
      await this.requestDeduplicationBatcher.flushBatches(); 
      return { message: 'All pending batches flushed successfully' };
    },
    { errorMessage: 'Failed to flush batches' }
  );

  clearDeduplication = EndpointWrapper.createAdminEndpoint(
    () => { 
      this.requestDeduplicationBatcher.clearDeduplication(); 
      return { message: 'Deduplication data cleared successfully' };
    },
    { errorMessage: 'Failed to clear deduplication data' }
  );

  getActiveBatches = EndpointWrapper.createGetEndpoint(
    () => this.requestDeduplicationBatcher.getActiveBatches(),
    { errorMessage: 'Failed to get active batch details' }
  );

  getDuplicates = EndpointWrapper.createGetEndpoint(
    () => this.requestDeduplicationBatcher.getDuplicateDetails(),
    { errorMessage: 'Failed to get duplicate request details' }
  );
}

module.exports = DeduplicationController;