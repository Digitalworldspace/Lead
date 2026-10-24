const {
  productName,
  affiliateLink,
  photoUrl,
  price,
  currency,
  description
} = req.body;

if (
  !productName ||
  !affiliateLink ||
  !photoUrl ||
  !price ||
  !currency ||
  !description
) {
  return res.status(400).json({
    success: false,
    message: "All fields are required."
  });
}

const allowedCurrencies = [
  "USD",
  "INR",
  "GBP",
  "EUR",
  "CAD",
  "AUD"
];

if (!allowedCurrencies.includes(currency)) {
  return res.status(400).json({
    success: false,
    message: "Invalid currency."
  });
}

const githubToken =
  await getInstallationToken();

const file =
  await getProducts(githubToken);

const newProduct = {
  title: String(productName).trim(),
  price: String(price).trim(),
  currency: currency,
  image: String(photoUrl).trim(),
  description: String(description).trim(),
  link: String(affiliateLink).trim(),
  active: true
};

file.products.push(newProduct);

await saveProducts(
  githubToken,
  file.products,
  file.sha,
  productName
);

res.json({
  success: true,
  message: "Product added successfully.",
  product: newProduct
});
