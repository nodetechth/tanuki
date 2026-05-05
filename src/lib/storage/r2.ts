import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  hasR2Env,
  r2AccessKeyId,
  r2BucketName,
  r2Endpoint,
  r2SecretAccessKey,
} from "@/lib/env";

let r2Client: S3Client | null = null;

function getR2Client() {
  if (!hasR2Env()) {
    return null;
  }

  if (!r2Client) {
    r2Client = new S3Client({
      region: "auto",
      endpoint: r2Endpoint(),
      credentials: {
        accessKeyId: r2AccessKeyId(),
        secretAccessKey: r2SecretAccessKey(),
      },
    });
  }

  return r2Client;
}

function extensionForFile(file: File) {
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith(".wav")) return "wav";
  if (fileName.endsWith(".m4a")) return "m4a";
  if (fileName.endsWith(".mp3")) return "mp3";
  if (fileName.endsWith(".webm")) return "webm";

  const mimeType = file.type;
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("mpeg")) return "mp3";
  return "webm";
}

export async function storeAudio(file: File, userId: string) {
  const extension = extensionForFile(file);
  const key = `submissions/${userId}/${crypto.randomUUID()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const client = getR2Client();

  if (!client) {
    return {
      key,
      url: `demo://${key}`,
    };
  }

  await client.send(
    new PutObjectCommand({
      Bucket: r2BucketName(),
      Key: key,
      Body: buffer,
      ContentType: file.type || "audio/webm",
    }),
  );

  return {
    key,
    url: `r2://${r2BucketName()}/${key}`,
  };
}

export async function createAudioReadUrl(key: string, expiresInSeconds = 300) {
  const client = getR2Client();

  if (!client) {
    return null;
  }

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: r2BucketName(),
      Key: key,
    }),
    { expiresIn: expiresInSeconds },
  );
}
