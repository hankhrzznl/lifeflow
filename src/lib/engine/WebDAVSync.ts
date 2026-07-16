/**
 * WebDAV同步 —— 通过WebDAV协议跨设备同步数据
 * 支持Nextcloud、坚果云等WebDAV服务
 */

export interface WebDAVConfig {
  url: string;
  username: string;
  password: string;
  filename?: string;
}

export class WebDAVSync {
  private config: WebDAVConfig;
  private defaultFilename = "lifeflow-backup.json";

  constructor(config: WebDAVConfig) {
    this.config = { ...config, filename: config.filename || this.defaultFilename };
  }

  /** 导出数据并上传到WebDAV */
  async upload(data: unknown): Promise<void> {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const fullUrl = this.joinUrl(this.config.url, this.config.filename!);

    const res = await fetch(fullUrl, {
      method: "PUT",
      headers: {
        Authorization: "Basic " + btoa(`${this.config.username}:${this.config.password}`),
        "Content-Type": "application/json",
        "If-None-Match": "*",
      },
      body: blob,
    });

    if (!res.ok && res.status === 412) {
      const res2 = await fetch(fullUrl, {
        method: "PUT",
        headers: {
          Authorization: "Basic " + btoa(`${this.config.username}:${this.config.password}`),
          "Content-Type": "application/json",
        },
        body: blob,
      });
      if (!res2.ok) throw new Error(`WebDAV upload failed: ${res2.status}`);
    } else if (!res.ok) {
      throw new Error(`WebDAV upload failed: ${res.status}`);
    }
  }

  /** 从WebDAV下载数据 */
  async download(): Promise<unknown> {
    const fullUrl = this.joinUrl(this.config.url, this.config.filename!);
    const res = await fetch(fullUrl, {
      headers: {
        Authorization: "Basic " + btoa(`${this.config.username}:${this.config.password}`),
      },
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`WebDAV download failed: ${res.status}`);
    }
    return await res.json();
  }

  /** 测试连接 */
  async test(): Promise<boolean> {
    try {
      const res = await fetch(this.config.url, {
        method: "PROPFIND",
        headers: {
          Authorization: "Basic " + btoa(`${this.config.username}:${this.config.password}`),
          Depth: "0",
        },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private joinUrl(base: string, path: string): string {
    return base.replace(/\/$/, "") + "/" + path.replace(/^\//, "");
  }
}
