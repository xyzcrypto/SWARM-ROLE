// Upload a file via XMLHttpRequest so we get real upload progress events
// (fetch() can't report upload progress). Used by the post cover uploader and
// the avatar uploader for an interactive progress bar.
export type UploadResult = { ok: boolean; status: number; data: any };

export function uploadFileWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
  field = "file"
): Promise<UploadResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const body = new FormData();
    body.append(field, file);
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      let data: any = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON */
      }
      onProgress(100);
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data });
    };
    xhr.onerror = () => resolve({ ok: false, status: 0, data: {} });
    xhr.send(body);
  });
}
