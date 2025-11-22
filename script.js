// Global chart reference
let scoreChart = null;

document.addEventListener("DOMContentLoaded", () => {
  const analyzeBtn = document.getElementById("analyzeBtn");
  const fileInput = document.getElementById("fileInput");
  const htmlInput = document.getElementById("htmlInput");
  const statusMessage = document.getElementById("statusMessage");

  analyzeBtn.addEventListener("click", () => {
    statusMessage.textContent = "";
    const file = fileInput.files[0];
    const pastedHtml = htmlInput.value.trim();

    if (!file && !pastedHtml) {
      statusMessage.textContent = "Please upload an HTML file or paste some HTML.";
      return;
    }

    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const html = e.target.result;
        runAnalysis(html);
      };
      reader.onerror = () => {
        statusMessage.textContent = "Error reading file.";
      };
      reader.readAsText(file);
    } else {
      runAnalysis(pastedHtml);
    }
  });
});

/**
 * Main analysis function
 */
function runAnalysis(htmlString) {
  const statusMessage = document.getElementById("statusMessage");
  statusMessage.textContent = "Analyzing...";

  const previewFrame = document.getElementById("previewFrame");
  // Load HTML into iframe so we can use getComputedStyle
  previewFrame.srcdoc = htmlString;

  previewFrame.onload = () => {
    const doc = previewFrame.contentDocument || previewFrame.contentWindow.document;
    if (!doc) {
      statusMessage.textContent = "Unable to load document for analysis.";
      return;
    }

    const analysis = analyzeDocument(doc, previewFrame);
    renderResults(analysis);
    statusMessage.textContent = "Analysis completed.";
  };
}

/**
 * Analyze the iframe document
 */
function analyzeDocument(doc, frame) {
  const issues = [];
  const summary = [];
  let totalScore = 0;
  let metricsCount = 0;

  // 1. Alt text check
  const imgElements = Array.from(doc.getElementsByTagName("img"));
  const totalImgs = imgElements.length;
  let missingAlt = 0;
  imgElements.forEach((img) => {
    const alt = (img.getAttribute("alt") || "").trim();
    if (!alt) missingAlt++;
  });

  let altScore = 100;
  if (totalImgs > 0) {
    const ratio = missingAlt / totalImgs;
    if (ratio > 0.5) altScore = 30;
    else if (ratio > 0.2) altScore = 60;
    else altScore = 90;
  }

  addIssue(
    issues,
    missingAlt > 0 ? "critical" : "ok",
    missingAlt > 0
      ? `Found ${missingAlt} image(s) without descriptive alt text out of ${totalImgs} images.`
      : "All images appear to have alt text."
  );
  summary.push(
    totalImgs === 0
      ? "No images detected."
      : `${missingAlt} of ${totalImgs} images are missing alt text (affects screen reader users).`
  );

  totalScore += altScore;
  metricsCount++;

  // 2. Heading structure check
  const headingTags = Array.from(doc.querySelectorAll("h1, h2, h3, h4, h5, h6"));
  let headingScore = 100;
  if (headingTags.length === 0) {
    headingScore = 50;
    addIssue(
      issues,
      "warning",
      "No heading tags (h1–h6) were found. Consider using headings to structure content."
    );
  } else {
    let jumps = 0;
    let lastLevel = null;
    headingTags.forEach((h) => {
      const level = parseInt(h.tagName.slice(1), 10);
      if (lastLevel !== null && level - lastLevel > 1) {
        jumps++;
      }
      lastLevel = level;
    });
    if (jumps > 0) {
      headingScore = 70;
      addIssue(
        issues,
        "warning",
        `Detected ${jumps} jump(s) in heading levels (e.g., h1 → h3). Consistent heading hierarchy improves navigation.`
      );
    } else {
      addIssue(issues, "ok", "Heading levels appear to follow a consistent hierarchy.");
    }
  }
  summary.push(
    headingTags.length === 0
      ? "No headings used; consider adding h1–h3 to organize the page."
      : `Found ${headingTags.length} heading(s); structure is mostly valid.`
  );

  totalScore += headingScore;
  metricsCount++;

  // 3. Font size check for basic text elements
  const textNodes = Array.from(doc.querySelectorAll("p, li, a, span, button"));
  let smallTextCount = 0;
  textNodes.forEach((el) => {
    const style = frame.contentWindow.getComputedStyle(el);
    const fontSizePx = parseFloat(style.fontSize);
    if (!isNaN(fontSizePx) && fontSizePx < 12) {
      smallTextCount++;
    }
  });

  let fontScore = 100;
  if (smallTextCount > 0) {
    fontScore = smallTextCount > textNodes.length * 0.3 ? 60 : 80;
    addIssue(
      issues,
      "warning",
      `${smallTextCount} text element(s) appear to use very small font sizes (< 12px). Consider increasing for readability.`
    );
  } else {
    addIssue(issues, "ok", "Font sizes for common text elements appear reasonably readable.");
  }

  summary.push(
    smallTextCount === 0
      ? "Font sizes look readable for most standard text elements."
      : "Some text uses very small font sizes, which may reduce readability."
  );

  totalScore += fontScore;
  metricsCount++;

  // 4. Color contrast check for common elements
  const contrastTargets = Array.from(doc.querySelectorAll("p, h1, h2, h3, h4, h5, h6, button, a"));
  let lowContrastCount = 0;

  contrastTargets.forEach((el) => {
    const style = frame.contentWindow.getComputedStyle(el);
    const fg = style.color;
    const bg = style.backgroundColor === "rgba(0, 0, 0, 0)" ? getEffectiveBackground(el, frame) : style.backgroundColor;

    const contrastRatio = computeContrastRatio(fg, bg);
    if (contrastRatio > 0 && contrastRatio < 4.5) {
      lowContrastCount++;
    }
  });

  let contrastScore = 100;
  if (lowContrastCount > 0) {
    contrastScore = lowContrastCount > contrastTargets.length * 0.2 ? 55 : 75;
    addIssue(
      issues,
      "critical",
      `${lowContrastCount} text element(s) may have low color contrast (contrast ratio < 4.5). This can be hard to read for many users.`
    );
  } else {
    addIssue(issues, "ok", "No obvious low-contrast text detected in common elements.");
  }

  summary.push(
    lowContrastCount === 0
      ? "Text contrast appears sufficient for most common elements."
      : "Some text elements may fail contrast guidelines; consider adjusting colors."
  );

  totalScore += contrastScore;
  metricsCount++;

  // 5. Responsiveness / horizontal scroll check
  const docEl = doc.documentElement;
  const hasHorizontalScroll = docEl.scrollWidth > docEl.clientWidth + 5;

  let responsiveScore = 100;
  if (hasHorizontalScroll) {
    responsiveScore = 65;
    addIssue(
      issues,
      "warning",
      "The layout appears to cause horizontal scrolling at a mobile width (~375px). This may indicate poor responsiveness."
    );
  } else {
    addIssue(
      issues,
      "ok",
      "No horizontal scrolling detected at a simulated mobile width. Layout seems reasonably responsive."
    );
  }

  summary.push(
    hasHorizontalScroll
      ? "Some elements overflow horizontally on mobile; review your responsive design."
      : "Layout adapts reasonably well to a mobile viewport width."
  );

  totalScore += responsiveScore;
  metricsCount++;

  const finalScore = Math.round(totalScore / metricsCount);

  return {
    finalScore,
    issues,
    summary
  };
}

/**
 * Add issue helper
 */
function addIssue(issues, severity, text) {
  issues.push({ severity, text });
}

/**
 * Compute contrast ratio between two CSS color strings
 */
function computeContrastRatio(fgColor, bgColor) {
  const fg = parseCssColor(fgColor);
  const bg = parseCssColor(bgColor);
  if (!fg || !bg) return -1;

  const lum1 = relativeLuminance(fg.r, fg.g, fg.b);
  const lum2 = relativeLuminance(bg.r, bg.g, bg.b);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Parse 'rgb(r, g, b)' or 'rgba(r, g, b, a)' into an object
 */
function parseCssColor(colorStr) {
  if (!colorStr) return null;
  const rgbRegex = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i;
  const match = colorStr.match(rgbRegex);
  if (!match) return null;
  return {
    r: parseFloat(match[1]),
    g: parseFloat(match[2]),
    b: parseFloat(match[3])
  };
}

/**
 * Relative luminance (WCAG)
 */
function relativeLuminance(r, g, b) {
  const rsrgb = r / 255;
  const gsrgb = g / 255;
  const bsrgb = b / 255;

  const rLin = rsrgb <= 0.03928 ? rsrgb / 12.92 : Math.pow((rsrgb + 0.055) / 1.055, 2.4);
  const gLin = gsrgb <= 0.03928 ? gsrgb / 12.92 : Math.pow((gsrgb + 0.055) / 1.055, 2.4);
  const bLin = bsrgb <= 0.03928 ? bsrgb / 12.92 : Math.pow((bsrgb + 0.055) / 1.055, 2.4);

  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Try to get a non-transparent background going up the DOM tree
 */
function getEffectiveBackground(el, frame) {
  let current = el;
  while (current && current !== frame.contentDocument.documentElement) {
    const style = frame.contentWindow.getComputedStyle(current);
    if (style.backgroundColor && style.backgroundColor !== "rgba(0, 0, 0, 0)") {
      return style.backgroundColor;
    }
    current = current.parentElement;
  }
  // default background (white)
  return "rgb(255, 255, 255)";
}

/**
 * Render results to the UI
 */
function renderResults(analysis) {
  const resultsSection = document.getElementById("resultsSection");
  const scoreValue = document.getElementById("scoreValue");
  const scoreLabel = document.getElementById("scoreLabel");
  const issuesList = document.getElementById("issuesList");
  const summaryList = document.getElementById("summaryList");

  resultsSection.classList.remove("hidden");

  // Score
  scoreValue.textContent = analysis.finalScore.toString();
  let label = "Needs improvement";
  if (analysis.finalScore >= 85) label = "Excellent accessibility & usability";
  else if (analysis.finalScore >= 70) label = "Good, but with room to improve";
  else if (analysis.finalScore >= 50) label = "Fair, consider fixing key issues";

  scoreLabel.textContent = label;

  // Summary
  summaryList.innerHTML = "";
  analysis.summary.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    summaryList.appendChild(li);
  });

  // Issues
  issuesList.innerHTML = "";
  analysis.issues.forEach((issue) => {
    const li = document.createElement("li");
    li.classList.add("issue-item");

    const badge = document.createElement("span");
    badge.classList.add("badge");
    if (issue.severity === "critical") {
      badge.classList.add("badge-critical");
      badge.textContent = "CRITICAL";
    } else if (issue.severity === "warning") {
      badge.classList.add("badge-warning");
      badge.textContent = "WARN";
    } else {
      badge.classList.add("badge-ok");
      badge.textContent = "OK";
    }

    const textSpan = document.createElement("span");
    textSpan.classList.add("issue-text");
    textSpan.textContent = issue.text;

    li.appendChild(badge);
    li.appendChild(textSpan);
    issuesList.appendChild(li);
  });

  renderScoreChart(analysis.finalScore);
}

/**
 * Draw or update the Chart.js score visualization
 */
function renderScoreChart(score) {
  const ctx = document.getElementById("scoreChart").getContext("2d");

  if (scoreChart) {
    scoreChart.destroy();
  }

  scoreChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Score", "Remaining"],
      datasets: [
        {
          data: [score, 100 - score],
          backgroundColor: ["#2563eb", "#dbeafe"],
          borderWidth: 0
        }
      ]
    },
    options: {
      cutout: "65%",
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
}
