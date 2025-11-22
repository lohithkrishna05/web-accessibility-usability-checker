# Web Accessibility & Usability Checker

A browser-based tool that analyzes HTML pages for common accessibility and usability issues and generates a usability score out of 100.

This project was built to practice front-end development, accessibility, responsive design, and basic UI analysis – aligned with requirements such as HTML, CSS, JavaScript, accessibility (WCAG), and user-centered design.

---

## Features

- Upload an `.html` file **or** paste raw HTML.
- Automatically checks for:
  - Missing `alt` text on images.
  - Basic heading hierarchy consistency (h1–h6).
  - Very small text (font size below 12px).
  - Low color contrast (approximate WCAG-inspired check).
  - Horizontal scrolling at a mobile width (~375px).
- Generates:
  - A **usability score** (0–100).
  - Text summary of key findings.
  - Detailed issue list (critical / warning / OK).
  - A simple **doughnut chart** using Chart.js to visualize the score.

---

## Tech Stack

- **HTML5**
- **CSS3**
- **JavaScript (Vanilla JS)**
- **Chart.js**

No backend is required – everything runs in the browser.

---

## How to Run Locally

1. Clone or download this repository.
2. Open `index.html` in a browser (you can also use a simple server like Live Server in VS Code).
3. Upload an HTML file or paste HTML into the textarea.
4. Click **"Run Accessibility Analysis"** to see the results.

---

## Folder Structure

```text
web-accessibility-usability-checker/
├── index.html
├── style.css
├── script.js
└── README.md
