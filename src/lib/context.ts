import type { AssessmentContext } from '../model/types';

export function blankContext(): AssessmentContext {
  return {
    ownershipTags: [], managementModel: null, intents: [], liquidity: null,
    horizon: null, profileOverride: null,
    company: { businessModel: null, sector: null, revenueBand: null, employeeBand: null, country: null, recurringShare: null, largestCustomer: null, earnings: null },
    topics: [], topicsNone: false, uncertainTopics: [], seller: null, sellerTax: null, fundingGapConfirmed: null,
  };
}
