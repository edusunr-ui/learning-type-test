import express from "express";
import { renderTeacherResultPdf } from "./render.mjs";
import { uploadPdfToDrive } from "./drive.mjs";

const app = express();
app.use(express.json({ limit: "2mb" }));

function verifyBearerToken(request) {
  const expectedToken = String(process.env.PDF_SERVICE_TOKEN || "").trim();
  if (!expectedToken) return;

  const authorization = String(request.headers.authorization || "");
  const actualToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!actualToken || actualToken !== expectedToken) {
    const error = new Error("Unauthorized");
    error.statusCode = 401;
    throw error;
  }
}

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

app.post("/generate-result-pdf", async (request, response) => {
  try {
    verifyBearerToken(request);
    const record = request.body || {};
    const rendered = await renderTeacherResultPdf(record);
    const uploaded = await uploadPdfToDrive(rendered);
    response.json({
      ok: true,
      ...uploaded,
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  console.log(`learning-type cloud pdf service listening on :${port}`);
});
