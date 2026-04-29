import { google } from "googleapis";

function getServiceAccountCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is required.");
  }

  return JSON.parse(raw);
}

function getDriveFolderId() {
  const folderId = String(process.env.GOOGLE_DRIVE_FOLDER_ID || "").trim();
  if (!folderId) {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID is required.");
  }
  return folderId;
}

export async function uploadPdfToDrive({ bytes, fileName, mimeType = "application/pdf" }) {
  const credentials = getServiceAccountCredentials();
  const folderId = getDriveFolderId();

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  const drive = google.drive({ version: "v3", auth });
  const media = {
    mimeType,
    body: Buffer.from(bytes),
  };

  const createResponse = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media,
    fields: "id,name,webViewLink,webContentLink",
  });

  return {
    resultPdfFileId: createResponse.data.id || "",
    resultPdfName: createResponse.data.name || fileName,
    resultPdfUrl: createResponse.data.webViewLink || createResponse.data.webContentLink || "",
  };
}
