#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(JobQueue, NSObject)

RCT_EXTERN_METHOD(addJob:(NSDictionary *)job)
RCT_EXTERN_METHOD(removeJob:(NSDictionary *)job)
RCT_EXTERN_METHOD(removeJobPermanently:(NSDictionary *)job)
RCT_EXTERN_METHOD(updateJob:(NSDictionary *)job)
RCT_EXTERN_METHOD(removeJobsByWorkerName:(NSString *)workerName)
RCT_EXTERN_METHOD(getNextJob:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getWorkInProgressJob:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getJobsForWorker:(NSString *)name count:(NSInteger) count resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getJobsForWorkerWithDeleted:(NSString *)name count:(NSInteger) count resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getJobs:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getJobsWithDeleted:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getActiveMarkedJobs:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)

@end
