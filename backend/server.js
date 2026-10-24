import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";

const app = express();

app.use(cors({
  origin: "https://digitalworldspace.github.io"
}));

app.use(express.json());

const PORT = process.env.PORT || 3000;

const GITHUB_OWNER = "Digitalworldspace";
const GITHUB_REPO = "Lead";
const GITHUB_FILE = "products.json";
const GITHUB_BRANCH = "main";

const APP_ID = process.env.GITHUB_APP_ID;
const PRIVATE_KEY = process.env.GITHUB_PRIVATE_KEY;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;


/*
========================================
CREATE GITHUB APP JWT
========================================
*/

function createAppJWT() {

  const now = Math.floor(Date.now() / 1000);

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


/*
========================================
GET INSTALLATION ID
========================================
*/

async function getInstallationId(appJWT) {

  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/installation`,
    {
      headers: {
        Authorization: `Bearer ${appJWT}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10"
      }
    }
  );


  if (!response.ok) {

    const text = await response.text();

    throw new Error(
      `GitHub installation error: ${text}`
    );

  }


  const data = await response.json();

  return data.id;

}


/*
========================================
GET INSTALLATION TOKEN
========================================
*/

async function getInstallationToken() {

  const appJWT = createAppJWT();

  const installationId =
    await getInstallationId(appJWT);


  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",

      headers: {
        Authorization: `Bearer ${appJWT}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10",
        "Content-Type": "application/json"
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


  if (!response.ok) {

    const text = await response.text();

    throw new Error(
      `GitHub token error: ${text}`
    );

  }


  const data = await response.json();

  return data.token;

}


/*
========================================
GET PRODUCTS.JSON
========================================
*/

async function getProducts(token) {

  const url =
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE}?ref=${GITHUB_BRANCH}`;


  const response =
    await fetch(url, {

      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10"
      }

    });


  if (!response.ok) {

    const text = await response.text();

    throw new Error(
      `Could not read products.json: ${text}`
    );

  }


  const data =
    await response.json();


  const decoded =
    Buffer.from(
      data.content.replace(/\n/g, ""),
      "base64"
    ).toString("utf8");


  let products;

  try {

    products = JSON.parse(decoded);

  } catch {

    throw new Error(
      "products.json contains invalid JSON"
    );

  }


  if (!Array.isArray(products)) {

    throw new Error(
      "products.json must contain an array"
    );

  }


  return {
    products,
    sha: data.sha
  };

}


/*
========================================
SAVE PRODUCTS.JSON
========================================
*/

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
    Buffer.from(
      content,
      "utf8"
    ).toString("base64");


  const url =
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE}`;


  const response =
    await fetch(url, {

      method: "PUT",

      headers: {

        Authorization:
          `Bearer ${token}`,

        Accept:
          "application/vnd.github+json",

        "X-GitHub-Api-Version":
          "2026-03-10",

        "Content-Type":
          "application/json"

      },

      body: JSON.stringify({

        message:
          `Add product: ${productName}`,

        content:
          encoded,

        sha,

        branch:
          GITHUB_BRANCH

      })

    });


  if (!response.ok) {

    const text =
      await response.text();

    throw new Error(
      `Could not update GitHub: ${text}`
    );

  }


  return await response.json();

}


/*
========================================
HEALTH CHECK
========================================
*/

app.get("/", (req, res) => {

  res.json({
    status: "ok",
    service: "Style Of Life Product Backend"
  });

});


/*
========================================
ADD PRODUCT
========================================
*/

app.post("/api/products", async (req, res) => {

  try {

    /*
      Simple admin authentication.
      Password stays on backend.
    */

    const password =
      req.headers["x-admin-password"];


    if (
      !ADMIN_PASSWORD ||
      password !== ADMIN_PASSWORD
    ) {

      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });

    }


    const {
      productName,
      affiliateLink,
      photoUrl,
      price,
      description
    } = req.body;


    /*
      Validate exactly our 5 fields
    */

    if (
      !productName ||
      !affiliateLink ||
      !photoUrl ||
      !price ||
      !description
    ) {

      return res.status(400).json({
        success: false,
        message: "All 5 fields are required."
      });

    }


    /*
      Get GitHub installation token
    */

    const githubToken =
      await getInstallationToken();


    /*
      Read current products
    */

    const file =
      await getProducts(
        githubToken
      );


    /*
      Create product
    */

    const newProduct = {

      title:
        String(productName).trim(),

      price:
        String(price).trim(),

      image:
        String(photoUrl).trim(),

      description:
        String(description).trim(),

      link:
        String(affiliateLink).trim(),

      active:
        true

    };


    /*
      Add product
    */

    file.products.push(
      newProduct
    );


    /*
      Save to GitHub
    */

    await saveProducts(

      githubToken,

      file.products,

      file.sha,

      productName

    );


    res.json({

      success: true,

      message:
        "Product added successfully.",

      product:
        newProduct

    });


  } catch (error) {

    console.error(error);


    res.status(500).json({

      success: false,

      message:
        error.message

    });

  }

});


/*
========================================
START SERVER
========================================
*/

app.listen(PORT, () => {

  console.log(
    `Server running on port ${PORT}`
  );

});
