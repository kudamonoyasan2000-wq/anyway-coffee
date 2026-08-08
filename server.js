const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT = __dirname;
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".json": "application/json; charset=utf-8",
};

function loadEnv(filepath) {
  const env = {};
  if (!fs.existsSync(filepath)) return env;
  const lines = fs.readFileSync(filepath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    env[key] = value;
  }
  return env;
}

const fileEnv = loadEnv(path.join(ROOT, ".env"));
const config = {
  serviceDomain: process.env.MICROCMS_SERVICE_DOMAIN || fileEnv.MICROCMS_SERVICE_DOMAIN || "",
  apiKey: process.env.MICROCMS_API_KEY || fileEnv.MICROCMS_API_KEY || "",
  endpoint: process.env.MICROCMS_PRODUCTS_ENDPOINT || fileEnv.MICROCMS_PRODUCTS_ENDPOINT || "products",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || fileEnv.STRIPE_SECRET_KEY || "",
  stripeShippingRateId:
    process.env.STRIPE_SHIPPING_RATE_ID ||
    fileEnv.STRIPE_SHIPPING_RATE_ID ||
    "shr_1TWAJcCCeEnxr8H5Bpkv2Yjr",
  port: Number(process.env.PORT || fileEnv.PORT || 8000),
};

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toCategory(value) {
  return String(value || "").toLowerCase() === "goods" ? "goods" : "coffee";
}

function normalizeImage(image) {
  if (!image) return null;
  if (typeof image === "string") return image;
  return image.url || image.src || null;
}

function optimizeImage(url, options = {}) {
  if (!url) return null;
  const {
    width,
    quality = 82,
    format = "webp",
  } = options;

  try {
    const parsed = new URL(url);
    if (width) parsed.searchParams.set("w", String(width));
    if (quality) parsed.searchParams.set("q", String(quality));
    if (format) parsed.searchParams.set("fm", format);
    return parsed.toString();
  } catch {
    return url;
  }
}

function withAssetVersion(url, version) {
  if (!url || !version) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(version)}`;
}

function deriveValueFromLabel(label = "", fallback = "") {
  const normalized = String(label || "").trim();
  if (!normalized) return fallback;
  const digits = normalized.match(/\d+/);
  if (digits) return digits[0];
  return normalized
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-ぁ-んァ-ヶ一-龠]/g, "") || fallback;
}

function normalizeRepeatEntries(entries = [], fieldOrder = []) {
  if (!Array.isArray(entries) || !entries.length) return [];

  const hasCombinedObjects = entries.some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    return fieldOrder.filter((field) => entry[field] !== undefined).length > 1;
  });

  if (hasCombinedObjects) {
    return entries.map((entry) => ({ ...entry }));
  }

  const items = [];
  let current = {};

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const fieldId = entry.fieldId || fieldOrder.find((field) => entry[field] !== undefined);
    if (!fieldId) continue;

    if (current[fieldId] !== undefined) {
      items.push(current);
      current = {};
    }

    if (entry[fieldId] !== undefined) {
      current[fieldId] = entry[fieldId];
    }
  }

  if (Object.keys(current).length) {
    items.push(current);
  }

  return items;
}

function normalizeListItem(item) {
  const assetVersion = item.revisedAt || item.updatedAt || item.publishedAt || "";
  return {
    id: item.id,
    name: item.name || item.title || "",
    italic: item.italic || item.originLabel || item.subtitle || null,
    category: toCategory(item.category),
    price: Number(item.price || 0),
    tag: item.tag || "",
    isNew: Boolean(item.isNew),
    color: item.color || "#B08650",
    image: withAssetVersion(optimizeImage(normalizeImage(item.image), { width: 1200, quality: 80 }), assetVersion),
    hoverImage: withAssetVersion(optimizeImage(normalizeImage(item.hoverImage || item.imageHover || item.hover_image), { width: 1200, quality: 80 }), assetVersion),
    heroImage: withAssetVersion(
      optimizeImage(normalizeImage(item.heroImage || item.heroBackgroundImage || item.hero_image), {
        width: 2200,
        quality: 84,
      }),
      assetVersion
    ),
    size: item.size || "m",
    offset: item.offset || null,
    hoverLabel: item.hoverLabel || item.hoverText || "Today, this one",
    headline: item.buyMetaText || item.buyMeta || null,
  };
}

function normalizeBlockValue(value) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function normalizeBlocks(blocks = []) {
  if (!Array.isArray(blocks) || !blocks.length) return [];

  const looksFlattened = blocks.some((block) => block && typeof block === "object" && block.fieldId);
  const sourceBlocks = [];

  if (looksFlattened) {
    let current = null;
    for (const entry of blocks) {
      if (!entry || typeof entry !== "object") continue;
      const fieldId = entry.fieldId;
      if (!fieldId) continue;

      if (fieldId === "type") {
        if (current && Object.keys(current).length) sourceBlocks.push(current);
        current = { type: normalizeBlockValue(entry.type) };
        continue;
      }

      if (!current) current = {};

      const rawValue = normalizeBlockValue(entry[fieldId]);
      if (current[fieldId] === undefined) {
        current[fieldId] = rawValue;
      } else if (current[`${fieldId}2`] === undefined) {
        current[`${fieldId}2`] = rawValue;
      }
    }
    if (current && Object.keys(current).length) sourceBlocks.push(current);
  } else {
    sourceBlocks.push(...blocks);
  }

  return sourceBlocks.map((block) => {
    const type = normalizeBlockValue(block.type) || block.fieldId;
    if (!type) return null;
    if (type === "image" || type === "imageSingle" || type === "imagePair") {
      return {
        type,
        aspect: normalizeBlockValue(block.aspect) || "wide",
        color: block.blockColor || block.color || "",
        url: optimizeImage(normalizeImage(block.blockImage || block.image || block.url), { width: 1600, quality: 82 }),
        aspect2: normalizeBlockValue(block.aspect2) || normalizeBlockValue(block.aspect) || "wide",
        color2: block.color2 || block.blockColor2 || block.blockColor || block.color || "",
        url2: optimizeImage(normalizeImage(block.image2 || block.blockImage2 || block.url2), { width: 1600, quality: 82 }),
      };
    }
    if (type === "spec") {
      return {
        type: "spec",
        items: Array.isArray(block.items) ? block.items : [],
        text: normalizeBlockValue(block.text) || "",
      };
    }
    return {
      ...block,
      type,
      text: normalizeBlockValue(block.text) || "",
      eyebrow: normalizeBlockValue(block.eyebrow) || "",
      title: normalizeBlockValue(block.title) || "",
      titleEm: normalizeBlockValue(block.titleEm) || "",
      size: normalizeBlockValue(block.size) || "",
    };
  }).filter(Boolean);
}

function normalizeOptions(item) {
  const fallbackSizes = [
    { value: "200", label: "200g", price: Number(item.price || 1800), selected: true },
  ];
  const fallbackGrinds = [
    { value: "bean", label: "豆", selected: true },
    { value: "ground", label: "粉", selected: false },
  ];

  const normalizedSizes = normalizeRepeatEntries(item.sizes, ["value", "label", "price", "selected"])
    .map((size, index) => {
      const label = size.label || size.value || "";
      return {
        value: String(size.value || deriveValueFromLabel(label, index === 0 ? "200" : `${index + 1}`)),
        label: label || `${deriveValueFromLabel(size.value, "200")}g`,
        price: Number(size.price ?? item.price ?? 0),
        selected: Boolean(size.selected) || (!size.selected && index === 0),
      };
    })
    .filter((size) => size.label);

  const normalizedGrinds = normalizeRepeatEntries(item.grinds, ["value", "label", "selected"])
    .map((grind, index) => {
      const label = grind.label || grind.value || "";
      return {
        value: String(grind.value || deriveValueFromLabel(label, index === 0 ? "bean" : `grind-${index + 1}`)),
        label: label || "豆",
        selected: Boolean(grind.selected) || (!grind.selected && index === 0),
      };
    })
    .filter((grind) => grind.label);

  return {
    sizes: normalizedSizes.length ? normalizedSizes : fallbackSizes,
    grinds: normalizedGrinds.length ? normalizedGrinds : fallbackGrinds,
  };
}

function normalizeVariants(item) {
  return normalizeRepeatEntries(
    item.variants,
    ["sizeValue", "grindValue", "priceId", "priceIdLive", "priceIdTest", "available"]
  )
    .map((variant) => ({
      sizeValue: String(variant.sizeValue || ""),
      grindValue: String(variant.grindValue || "").toLowerCase(),
      priceId: String(variant.priceId || ""),
      priceIdLive: String(variant.priceIdLive || variant.livePriceId || ""),
      priceIdTest: String(variant.priceIdTest || variant.testPriceId || ""),
      available: variant.available === undefined ? true : Boolean(variant.available),
    }))
    .filter((variant) => variant.priceId || variant.priceIdLive || variant.priceIdTest);
}

function normalizeDetail(item) {
  const base = normalizeListItem(item);
  return {
    ...base,
    description: item.description || "",
    buyMetaEyebrow: item.buyMetaEyebrow || item.notesLabel || "",
    buyMetaText: item.buyMetaText || item.buyMeta || "",
    code: item.code || "",
    blocks: normalizeBlocks(item.blocks || []),
    sizes: normalizeOptions(item).sizes,
    grinds: normalizeOptions(item).grinds,
    variants: normalizeVariants(item),
    defaultPriceId: item.defaultPriceId || "",
    related: Array.isArray(item.related) ? item.related.map(normalizeListItem) : [],
  };
}

function normalizeGrindValue(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (["whole", "whole bean", "bean", "豆"].includes(normalized)) return "bean";
  if (["medium", "medium grind", "ground", "粉"].includes(normalized)) return "ground";
  return normalized;
}

function isLiveStripeMode() {
  return /^sk_live_/.test(config.stripeSecretKey);
}

function resolveVariantPriceId(variant) {
  if (isLiveStripeMode()) {
    return variant.priceIdLive || variant.priceId || "";
  }
  return variant.priceIdTest || variant.priceId || "";
}

function resolveDefaultPriceId(item) {
  if (isLiveStripeMode()) {
    return item.defaultPriceIdLive || item.liveDefaultPriceId || item.defaultPriceId || "";
  }
  return item.defaultPriceIdTest || item.testDefaultPriceId || item.defaultPriceId || "";
}

function resolvePriceId(item, lineItem = {}) {
  const category = toCategory(item.category);
  if (category === "goods") {
    return resolveDefaultPriceId(item) || resolveVariantPriceId(normalizeVariants(item)[0] || {}) || "";
  }

  const size = String(lineItem.size || "");
  const grind = normalizeGrindValue(lineItem.grind);
  const variants = normalizeVariants(item);

  const matched = variants.find((variant) =>
    String(variant.sizeValue || "") === size &&
    normalizeGrindValue(variant.grindValue) === grind &&
    variant.available !== false
  );

  return matched ? resolveVariantPriceId(matched) : "";
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

async function createCheckoutSession({ items = [], origin }) {
  if (!config.stripeSecretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${origin}/index.html?checkout=success`);
  params.set("cancel_url", `${origin}/index.html?checkout=cancel`);
  params.set("billing_address_collection", "required");
  params.set("allow_promotion_codes", "true");
  params.set("phone_number_collection[enabled]", "true");
  if (config.stripeShippingRateId) {
    params.set("shipping_address_collection[allowed_countries][0]", "JP");
    params.set("shipping_options[0][shipping_rate]", config.stripeShippingRateId);
  }

  items.forEach((item, index) => {
    params.set(`line_items[${index}][price]`, item.priceId);
    params.set(`line_items[${index}][quantity]`, String(item.quantity || 1));
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "Failed to create Stripe Checkout Session");
  }

  return data;
}

async function fetchMicroCMS(resourcePath, search = "") {
  if (!config.serviceDomain || !config.apiKey) {
    throw new Error("Missing microCMS credentials");
  }
  const url = `https://${config.serviceDomain}.microcms.io/api/v1/${config.endpoint}${resourcePath}${search}`;
  const res = await fetch(url, {
    headers: {
      "X-MICROCMS-API-KEY": config.apiKey,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`microCMS ${res.status}: ${body}`);
  }
  return res.json();
}

async function handleApi(req, res, pathname) {
  try {
    if (pathname === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        configured: Boolean(config.serviceDomain && config.apiKey),
      });
    }

    if (pathname === "/api/products") {
      const data = await fetchMicroCMS("", "?limit=100&depth=2");
      return sendJson(res, 200, {
        contents: (data.contents || []).map(normalizeListItem),
      });
    }

    const detailMatch = pathname.match(/^\/api\/products\/([^/]+)$/);
    if (detailMatch) {
      const id = decodeURIComponent(detailMatch[1]);
      const data = await fetchMicroCMS(`/${id}`, "?depth=3");
      return sendJson(res, 200, normalizeDetail(data));
    }

    if (pathname === "/api/checkout/session" && req.method === "POST") {
      const payload = await readJsonBody(req);
      const requestItems = Array.isArray(payload.items) ? payload.items : [];

      if (!requestItems.length) {
        return sendJson(res, 400, { message: "Cart is empty" });
      }

      const ids = [...new Set(requestItems.map((item) => item.id).filter(Boolean))];
      const products = await Promise.all(
        ids.map((id) => fetchMicroCMS(`/${encodeURIComponent(id)}`, "?depth=3"))
      );
      const productMap = new Map(products.map((product) => [product.id, product]));

      const lineItems = requestItems.map((item) => {
        const product = productMap.get(item.id);
        if (!product) {
          throw new Error(`Product not found: ${item.id}`);
        }

        const priceId = resolvePriceId(product, item);
        if (!priceId) {
          throw new Error(`No Stripe price configured for ${product.name}`);
        }

        return {
          priceId,
          quantity: Math.max(1, Number(item.quantity || 1)),
        };
      });

      const origin = `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host || `127.0.0.1:${config.port}`}`;
      const session = await createCheckoutSession({ items: lineItems, origin });
      return sendJson(res, 200, { url: session.url, id: session.id });
    }

    return sendJson(res, 404, { message: "Not found" });
  } catch (error) {
    return sendJson(res, 500, {
      message: error.message,
    });
  }
}

function serveStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const fullPath = path.join(ROOT, safePath);
  if (!fullPath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(fullPath, (err, file) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
    });
    res.end(file);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
  if (url.pathname.startsWith("/api/")) {
    return handleApi(req, res, url.pathname);
  }
  return serveStatic(req, res, url.pathname);
});

server.listen(config.port, () => {
  console.log(`hysd server running at http://127.0.0.1:${config.port}`);
});
