import { ApiError, internalClient, internalToken, required } from "@vayro/service-kit";

// GPS devices belong to gps-device-service; this service looks one up by its code and reports that it just received data.
export interface DeviceInfo {
  gps_device_id: string;
  company_id: string;
  vehicle_id: string;
  source_type: "gps_device" | "provider_api" | "driver_mobile_app";
  disabled: boolean;
}

export interface DeviceDirectory {
  /** null when no device with that code is registered in the company. */
  byCode(companyId: string, deviceCode: string): Promise<DeviceInfo | null>;
  markReceived(deviceId: string, at: Date): Promise<void>;
}

export function httpDeviceDirectory(): DeviceDirectory {
  const devices = internalClient(required("GPS_DEVICE_SERVICE_URL"), internalToken());
  return {
    async byCode(companyId, deviceCode) {
      const { status, body } = await devices("GET", `/internal/devices/by-code?company_id=${companyId}&device_code=${encodeURIComponent(deviceCode)}`);
      if (status === 404) return null;
      if (status !== 200) throw new ApiError(502, "UPSTREAM_ERROR", `gps-device-service returned ${status}`);
      return body.data;
    },
    async markReceived(deviceId, at) {
      const { status } = await devices("POST", `/internal/devices/${deviceId}/received`, { body: { received_at: at.toISOString() } });
      if (status !== 200) throw new ApiError(502, "UPSTREAM_ERROR", `gps-device-service returned ${status}`);
    },
  };
}
