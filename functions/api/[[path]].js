function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function getConfig(env = {}) {
  return {
    serviceDomain: env.MICROCMS_SERVICE_DOMAIN || "",
    apiKey: env.MICROCMS_API_KEY || "",
    endpoint: env.MICROCMS_PRODUCTS_ENDPOINT || "products",
    siteUrl: env.SITE_URL || "",
    stripeSuccessUrl: env.STRIPE_SUCCESS_URL || "",
    stripeCancelUrl: env.STRIPE_CANCEL_URL || "",
    stripeSecretKey: env.STRIPE_SECRET_KEY || "",
    stripeShippingRateId: env.STRIPE_SHIPPING_RATE_ID || "shr_1TWAJcCCeEnxr8H5Bpkv2Yjr",
  };
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
  const { width, quality = 82, format = "webp" } = options;

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

  if (Object.keys(current).length) items.push(current);
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

function isLiveStripeMode(config) {
  return /^sk_live_/.test(config.stripeSecretKey);
}

function resolveVariantPriceId(config, variant) {
  if (isLiveStripeMode(config)) {
    return variant.priceIdLive || variant.priceId || "";
  }
  return variant.priceIdTest || variant.priceId || "";
}

function resolveDefaultPriceId(config, item) {
  if (isLiveStripeMode(config)) {
    return item.defaultPriceIdLive || item.liveDefaultPriceId || item.defaultPriceId || "";
  }
  return item.defaultPriceIdTest || item.testDefaultPriceId || item.defaultPriceId || "";
}

function resolvePriceId(config, item, lineItem = {}) {
  const category = toCategory(item.category);
  if (category === "goods") {
    return resolveDefaultPriceId(config, item) || resolveVariantPriceId(config, normalizeVariants(item)[0] || {}) || "";
  }

  const size = String(lineItem.size || "");
  const grind = normalizeGrindValue(lineItem.grind);
  const variants = normalizeVariants(item);

  const matched = variants.find((variant) =>
    String(variant.sizeValue || "") === size &&
    normalizeGrindValue(variant.grindValue) === grind &&
    variant.available !== false
  );

  return matched ? resolveVariantPriceId(config, matched) : "";
}

function normalizeBaseUrl(value = "") {
  return String(value).trim().replace(/\/+$/, "");
}

function resolveCheckoutReturnUrls(config, origin) {
  const baseUrl = normalizeBaseUrl(config.siteUrl || origin);
  return {
    successUrl: config.stripeSuccessUrl || `${baseUrl}/index.html?checkout=success`,
    cancelUrl: config.stripeCancelUrl || `${baseUrl}/index.html?checkout=cancel`,
  };
}

async function createCheckoutSession(config, { items = [], origin }) {
  if (!config.stripeSecretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  const { successUrl, cancelUrl } = resolveCheckoutReturnUrls(config, origin);
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", successUrl);
  params.set("cancel_url", cancelUrl);
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

async function fetchMicroCMS(config, resourcePath, search = "") {
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

export async function onRequest(context) {
  const { request, env } = context;
  const config = getConfig(env);
  const url = new URL(request.url);
  const pathname = url.pathname;

  try {
    if (pathname === "/api/health") {
      return json({
        ok: true,
        configured: Boolean(config.serviceDomain && config.apiKey),
      });
    }

    if (pathname === "/api/products") {
      const data = await fetchMicroCMS(config, "", "?limit=100&depth=2");
      return json({
        contents: (data.contents || []).map(normalizeListItem),
      });
    }

    const detailMatch = pathname.match(/^\/api\/products\/([^/]+)$/);
    if (detailMatch) {
      const id = decodeURIComponent(detailMatch[1]);
      const data = await fetchMicroCMS(config, `/${encodeURIComponent(id)}`, "?depth=3");
      return json(normalizeDetail(data));
    }

    if (pathname === "/api/checkout/session" && request.method === "POST") {
      const payload = await request.json().catch(() => {
        throw new Error("Invalid JSON body");
      });
      const requestItems = Array.isArray(payload.items) ? payload.items : [];

      if (!requestItems.length) {
        return json({ message: "Cart is empty" }, 400);
      }

      const ids = [...new Set(requestItems.map((item) => item.id).filter(Boolean))];
      const products = await Promise.all(
        ids.map((id) => fetchMicroCMS(config, `/${encodeURIComponent(id)}`, "?depth=3"))
      );
      const productMap = new Map(products.map((product) => [product.id, product]));

      const lineItems = requestItems.map((item) => {
        const product = productMap.get(item.id);
        if (!product) {
          throw new Error(`Product not found: ${item.id}`);
        }

        const priceId = resolvePriceId(config, product, item);
        if (!priceId) {
          throw new Error(`No Stripe price configured for ${product.name}`);
        }

        return {
          priceId,
          quantity: Math.max(1, Number(item.quantity || 1)),
        };
      });

      const origin = url.origin;
      const session = await createCheckoutSession(config, { items: lineItems, origin });
      return json({ url: session.url, id: session.id });
    }

    return json({ message: "Not found" }, 404);
  } catch (error) {
    return json({ message: error.message }, 500);
  }
}
