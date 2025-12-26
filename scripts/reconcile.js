import { Storage } from "@google-cloud/storage";
import fs from "fs";
import path from "path";

const BUCKET = "vit-pyqs";
const COURSES_DIR = "courses";
const GLOBAL_FILE = "global.json";

const storage = new Storage();

async function run() {
  const [files] = await storage.bucket(BUCKET).getFiles();

  const papersByCourse = {};
  const courseMap = {}; // courseCode -> courseTitle
  let totalPapers = 0;

  for (const file of files) {
    if (!file.name.endsWith(".pdf")) continue;
    if (file.name.startsWith("RAW_UPLOADS/")) continue;

    const parts = file.name.split("/");
    if (parts.length < 3) continue;

    const courseFolder = parts[0];
    const exam = parts[1];
    const filename = parts[2];

    const courseCode = courseFolder.split("-")[0];
    const courseTitle = courseFolder.replace(`${courseCode}-`, "");

    courseMap[courseCode] = courseTitle;

    if (!papersByCourse[courseCode]) {
      papersByCourse[courseCode] = {
        course_code: courseCode,
        course_title: courseTitle,
        papers: [],
        last_updated: ""
      };
    }

    papersByCourse[courseCode].papers.push({
      paper_id: filename.replace(".pdf", ""),
      exam,
      file_url: `https://storage.googleapis.com/${BUCKET}/${file.name}`,
      file_name: filename
    });

    totalPapers++;
  }

  /* ---------- HARD RESET courses/ ---------- */

  if (!fs.existsSync(COURSES_DIR)) {
    fs.mkdirSync(COURSES_DIR);
  }

  for (const file of fs.readdirSync(COURSES_DIR)) {
    if (file.endsWith(".json")) {
      fs.unlinkSync(path.join(COURSES_DIR, file));
    }
  }

  /* ---------- WRITE COURSE FILES ---------- */

  for (const [code, data] of Object.entries(papersByCourse)) {
    if (data.papers.length === 0) continue;

    data.last_updated = new Date().toISOString();

    fs.writeFileSync(
      path.join(COURSES_DIR, `${code}.json`),
      JSON.stringify(data, null, 2)
    );
  }

  /* ---------- WRITE GLOBAL ---------- */

  const global = {
    total_courses: Object.keys(courseMap).length,
    total_papers: totalPapers,
    courses: courseMap, // code -> title
    last_updated: new Date().toISOString()
  };

  fs.writeFileSync(GLOBAL_FILE, JSON.stringify(global, null, 2));

  console.log("Reconciliation complete");
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
