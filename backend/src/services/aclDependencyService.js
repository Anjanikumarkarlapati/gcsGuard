import { GoogleAuth } from "google-auth-library";
import { PROJECT_ID, STORAGE_PROVIDER } from "../config/gcp.js";
import { demoAclUsage } from "../config/demoBuckets.js";

const METRIC = "storage.googleapis.com/authz/acl_operations_count";
const REQUIRED_ACL_OPERATION = "OBJECT_ACCESS_REQUIRED_OBJECT_ACL";
const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/monitoring.read"] });

export async function getAclDependency(bucketName) {
  const end = new Date();
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 2);
  const interval = { startTime: start.toISOString(), endTime: end.toISOString() };

  if (STORAGE_PROVIDER === "memory") {
    const count = demoAclUsage(bucketName);
    return { status: count > 0 ? "ACL_DEPENDENCY_FOUND" : "SIMULATED_ZERO", count, bucketName, metric: METRIC, operation: REQUIRED_ACL_OPERATION, interval };
  }

  if (!PROJECT_ID) return { status: "UNAVAILABLE", count: null, bucketName, metric: METRIC, operation: REQUIRED_ACL_OPERATION, interval, reason: "GCP_PROJECT_ID is not configured" };

  try {
    const client = await auth.getClient();
    const filter = [
      `metric.type="${METRIC}"`,
      'resource.type="gcs_bucket"',
      `resource.labels.bucket_name="${bucketName}"`,
      `metric.labels.acl_operation="${REQUIRED_ACL_OPERATION}"`,
    ].join(" AND ");
    let pageToken;
    let count = 0n;
    let timeSeriesCount = 0;
    do {
      const { data } = await client.request({
        url: `https://monitoring.googleapis.com/v3/projects/${encodeURIComponent(PROJECT_ID)}/timeSeries`,
        params: {
          filter,
          "interval.startTime": interval.startTime,
          "interval.endTime": interval.endTime,
          "aggregation.alignmentPeriod": "86400s",
          "aggregation.perSeriesAligner": "ALIGN_SUM",
          "aggregation.crossSeriesReducer": "REDUCE_SUM",
          "aggregation.groupByFields": ["resource.labels.bucket_name"],
          view: "FULL",
          pageSize: 1000,
          ...(pageToken ? { pageToken } : {}),
        },
      });
      const series = data.timeSeries || [];
      timeSeriesCount += series.length;
      for (const timeSeries of series) for (const point of timeSeries.points || []) {
        const raw = point.value?.int64Value ?? point.value?.doubleValue ?? 0;
        count += BigInt(Math.trunc(Number(raw)));
      }
      pageToken = data.nextPageToken;
    } while (pageToken);

    return {
      status: count > 0n ? "ACL_DEPENDENCY_FOUND" : "ZERO",
      count: Number(count),
      bucketName,
      metric: METRIC,
      operation: REQUIRED_ACL_OPERATION,
      timeSeriesCount,
      interval,
      interpretation: timeSeriesCount ? "Metric queried successfully; summed points cover the returned time series" : "Monitoring returned no matching time series for this bucket and interval",
    };
  } catch (error) {
    return {
      status: "UNAVAILABLE",
      count: null,
      bucketName,
      metric: METRIC,
      operation: REQUIRED_ACL_OPERATION,
      interval,
      reason: error.response?.data?.error?.message || error.message,
      httpStatus: error.response?.status || null,
    };
  }
}
