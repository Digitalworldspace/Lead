import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";

const app = express();

const PORT = process.env.PORT || 3000;

/* =========================================================
   CORS
========================================================= */

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "X-Admin-Password"
    ]
  })
);

app.use(express.json());

/* =========================================================
   GITHUB SETTINGS
========================================================= */

const GITHUB_OWNER =
  "Digitalworldspace";

const GITHUB_REPO =
  "Lead";

const GITHUB_FILE =
  "products.json";

const GITHUB_BRANCH =
  "main";

/* =========================================================
   ENVIRONMENT VARIABLES
========================================================= */

const APP_ID =
  process.env.GITHUB_APP_ID;

const PRIVATE_KEY =
  (process.env.GITHUB_PRIVATE_KEY || "")
    .replace(/\\n/g, "\n")
    .trim();

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD;

/* =========================================================
   BASIC CONFIG CHECK
========================================================= */

function checkConfiguration() {

  if (!APP_ID) {
    throw new Error(
      "GITHUB_APP_ID is missing."
    );
  }

  if (!PRIVATE_KEY) {
    throw new Error(
      "GITHUB_PRIVATE_KEY is missing."
    );
  }

  if (!ADMIN_PASSWORD) {
    throw new Error(
      "ADMIN_PASSWORD is missing."
    );
  }

}

/* =========================================================
   CREATE GITHUB APP JWT
========================================================= */

function createAppJWT() {

  checkConfiguration();

  const now =
    Math.floor(Date.now() / 1000);

  return jwt.sign(
    {
      iat: now - 60,
      exp: now + 540,
      iss: APP_ID
    },
    PRIVATE_KEY,
    {
      algorithm: "RS256"
    }
  );

}

/* =========================================================
   GET GITHUB APP INSTALLATION
========================================================= */

async function getInstallationId(
  appJWT
) {

  const response =
    await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/installation`,
      {
        headers: {
          Authorization:
            `Bearer ${appJWT}`,

          Accept:
            "application/vnd.github+json",

          "X-GitHub-Api-Version":
            "2022-11-28"
        }
      }
    );

  const text =
    await response.text();

  if (!response.ok) {

    throw new Error(
      `GitHub installation error (${response.status}): ${text}`
    );

  }

  let data;

  try {

    data =
      JSON.parse(text);

  } catch {

    throw new Error(
      "GitHub returned invalid installation response."
    );

  }

  if (!data.id) {

    throw new Error(
      "GitHub installation ID was not found."
    );

  }

  return data.id;

}

/* =========================================================
   GET INSTALLATION ACCESS TOKEN
========================================================= */

async function getInstallationToken() {

  const appJWT =
    createAppJWT();

  const installationId =
    await getInstallationId(
      appJWT
    );

  const response =
    await fetch(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${appJWT}`,

          Accept:
            "application/vnd.github+json",

          "X-GitHub-Api-Version":
            "2022-11-28",

          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          repositories: [
            GITHUB_REPO
          ],

          permissions: {
            contents: "write"
          }
        })
      }
    );

  const text =
    await response.text();

  if (!response.ok) {

    throw new Error(
      `GitHub access token error (${response.status}): ${text}`
    );

  }

  let data;

  try {

    data =
      JSON.parse(text);

  } catch {

    throw new Error(
      "GitHub returned invalid token response."
    );

  }

  if (!data.token) {

    throw new Error(
      "GitHub installation token was not created."
    );

  }

  return data.token;

}

/* =========================================================
   READ products.json
========================================================= */

async function getProducts(
  token
) {

  const url =
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE}?ref=${GITHUB_BRANCH}`;

  const response =
    await fetch(
      url,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,

          Accept:
            "application/vnd.github+json",

          "X-GitHub-Api-Version":
            "2022-11-28"
        }
      }
    );

  const text =
    await response.text();

  if (!response.ok) {

    throw new Error(
      `Could not read products.json (${response.status}): ${text}`
    );

  }

  let data;

  try {

    data =
      JSON.parse(text);

  } catch {

    throw new Error(
      "GitHub returned invalid file response."
    );

  }

  if (!data.content) {

    throw new Error(
      "products.json content was not found."
    );

  }

  const decoded =
    Buffer.from(
      data.content.replace(/\n/g, ""),
      "base64"
    ).toString("utf8");

  let products;

  try {

    products =
      JSON.parse(decoded);

  } catch {

    throw new Error(
      "products.json contains invalid JSON."
    );

  }

  if (!Array.isArray(products)) {

    throw new Error(
      "products.json must contain an array."
    );

  }

  return {
    products,
    sha: data.sha
  };

}

/* =========================================================
   SAVE products.json
========================================================= */

async function saveProducts(
  token,
  products,
  sha,
  productName
) {

  const content =
    JSON.stringify(
      products,
      null,
      2
    ) + "\n";

  const encoded =
    Buffer
      .from(
        content,
        "utf8"
      )
      .toString("base64");

  const url =
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE}`;

  const response =
    await fetch(
      url,
      {
        method: "PUT",

        headers: {
          Authorization:
            `Bearer ${token}`,

          Accept:
            "application/vnd.github+json",

          "X-GitHub-Api-Version":
            "2022-11-28",

          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({

          message:
            `Add product: ${productName}`,

          content:
            encoded,

          sha:
            sha,

          branch:
            GITHUB_BRANCH

        })
      }
    );

  const text =
    await response.text();

  if (!response.ok) {

    throw new Error(
      `Could not update GitHub (${response.status}): ${text}`
    );

  }

  try {

    return JSON.parse(text);

  } catch {

    return {
      success: true
    };

  }

}

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get(
  "/",
  (req, res) => {

    res.json({
      status: "ok",
      service:
        "Style Of Life Product Backend"
    });

  }
);

/* =========================================================
   CONFIG CHECK
========================================================= */

app.get(
  "/api/status",
  (req, res) => {

    res.json({

      success: true,

      githubAppConfigured:
        Boolean(APP_ID),

      privateKeyConfigured:
        Boolean(PRIVATE_KEY),

      adminPasswordConfigured:
        Boolean(ADMIN_PASSWORD),

      repository:
        `${GITHUB_OWNER}/${GITHUB_REPO}`,

      file:
        GITHUB_FILE,

      branch:
        GITHUB_BRANCH

    });

  }
);

/* =========================================================
   ADD PRODUCT
========================================================= */

app.post(
  "/api/products",
  async (req, res) => {

    try {

      /* -----------------------------------------------
         ADMIN AUTHENTICATION
      ------------------------------------------------ */

      const password =
        req.headers[
          "x-admin-password"
        ];

      if (
        !ADMIN_PASSWORD ||
        password !== ADMIN_PASSWORD
      ) {

        return res
          .status(401)
          .json({

            success: false,

            message:
              "Unauthorized. Incorrect admin password."

          });

      }

      /* -----------------------------------------------
         GET DATA
      ------------------------------------------------ */

      const {
        productName,
        affiliateLink,
        photoUrl,
        price,
        currency,
        description
      } = req.body || {};

      /* -----------------------------------------------
         REQUIRED FIELDS
      ------------------------------------------------ */

      if (
        !productName ||
        !affiliateLink ||
        !photoUrl ||
        !price ||
        !currency ||
        !description
      ) {

        return res
          .status(400)
          .json({

            success: false,

            message:
              "All product fields are required."

          });

      }

      /* -----------------------------------------------
         VALIDATE CURRENCY
      ------------------------------------------------ */

      const allowedCurrencies = [
        "USD",
        "INR",
        "GBP",
        "EUR",
        "CAD",
        "AUD"
      ];

      if (
        !allowedCurrencies.includes(
          String(currency).toUpperCase()
        )
      ) {

        return res
          .status(400)
          .json({

            success: false,

            message:
              "Invalid currency."

          });

      }

      /* -----------------------------------------------
         VALIDATE AFFILIATE LINK
      ------------------------------------------------ */

      if (
        !/^https?:\/\//i.test(
          String(affiliateLink).trim()
        )
      ) {

        return res
          .status(400)
          .json({

            success: false,

            message:
              "Invalid Amazon affiliate link."

          });

      }

      /* -----------------------------------------------
         VALIDATE PHOTO URL
      ------------------------------------------------ */

      if (
        !/^https?:\/\//i.test(
          String(photoUrl).trim()
        )
      ) {

        return res
          .status(400)
          .json({

            success: false,

            message:
              "Invalid photo URL."

          });

      }

      /* -----------------------------------------------
         GET GITHUB TOKEN
      ------------------------------------------------ */

      const githubToken =
        await getInstallationToken();

      /* -----------------------------------------------
         GET CURRENT PRODUCTS
      ------------------------------------------------ */

      const file =
        await getProducts(
          githubToken
        );

      /* -----------------------------------------------
         CREATE PRODUCT
      ------------------------------------------------ */

      const newProduct = {

        title:
          String(
            productName
          ).trim(),

        price:
          String(
            price
          ).trim(),

        currency:
          String(
            currency
          ).trim().toUpperCase(),

        image:
          String(
            photoUrl
          ).trim(),

        description:
          String(
            description
          ).trim(),

        link:
          String(
            affiliateLink
          ).trim(),

        active:
          true

      };

      /* -----------------------------------------------
         ADD PRODUCT
      ------------------------------------------------ */

      file.products.push(
        newProduct
      );

      /* -----------------------------------------------
         SAVE TO GITHUB
      ------------------------------------------------ */

      await saveProducts(

        githubToken,

        file.products,

        file.sha,

        productName

      );

      /* -----------------------------------------------
         SUCCESS
      ------------------------------------------------ */

      return res.json({

        success:
          true,

        message:
          "Product added successfully.",

        product:
          newProduct

      });

    } catch (error) {

      console.error(
        "PRODUCT ERROR:",
        error
      );

      return res
        .status(500)
        .json({

          success: false,

          message:
            error?.message ||
            "Internal server error."

        });

    }

  }
);

/* =========================================================
   404 HANDLER
========================================================= */

app.use(
  (req, res) => {

    res
      .status(404)
      .json({

        success: false,

        message:
          "API route not found.",

        path:
          req.path

      });

  }
);

/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {

    console.error(
      "SERVER ERROR:",
      error
    );

    if (
      res.headersSent
    ) {

      return next(error);

    }

    res
      .status(500)
      .json({

        success: false,

        message:
          error?.message ||
          "Internal server error."

      });

  }
);

/* =========================================================
   START SERVER
========================================================= */

app.listen(
  PORT,
  () => {

    console.log(
      "========================================"
    );

    console.log(
      "Style Of Life Product Backend"
    );

    console.log(
      `Server running on port ${PORT}`
    );

    console.log(
      `Repository: ${GITHUB_OWNER}/${GITHUB_REPO}`
    );

    console.log(
      `File: ${GITHUB_FILE}`
    );

    console.log(
      `Branch: ${GITHUB_BRANCH}`
    );

    console.log(
      `GitHub App ID configured: ${Boolean(APP_ID)}`
    );

    console.log(
      `Private key configured: ${Boolean(PRIVATE_KEY)}`
    );

    console.log(
      `Admin password configured: ${Boolean(ADMIN_PASSWORD)}`
    );

    console.log(
      "========================================"
    );

  }
);
