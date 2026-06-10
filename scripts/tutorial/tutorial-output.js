const fs = require('fs');
const path = require('path');

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function createTutorialOutput({ outputDir, title, introduction }) {
  const steps = [];

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  async function removeAnnotation(webContents) {
    await webContents.executeJavaScript(`
      document.getElementById('bdd-tutorial-layer')?.remove();
      document.getElementById('bdd-tutorial-style')?.remove();
      true;
    `, true);
  }

  async function captureStep(webContents, step) {
    await removeAnnotation(webContents);

    const result = await webContents.executeJavaScript(`
      (() => {
        const step = ${JSON.stringify(step)};
        const style = document.createElement('style');
        style.id = 'bdd-tutorial-style';
        style.textContent = \`
          #bdd-tutorial-layer {
            position: fixed;
            inset: 0;
            z-index: 2147483647;
            pointer-events: none;
            font-family: Arial, sans-serif;
          }
          .Toastify { display: none !important; }
          #bdd-tutorial-layer .tutorial-dim {
            position: absolute;
            inset: 0;
            background: rgba(15, 23, 42, .22);
          }
          #bdd-tutorial-layer .tutorial-focus {
            position: fixed;
            border: 5px solid #f59e0b;
            border-radius: 12px;
            box-shadow: 0 0 0 9999px rgba(15, 23, 42, .22), 0 0 22px rgba(245, 158, 11, .9);
            background: transparent;
          }
          #bdd-tutorial-layer .tutorial-card {
            position: fixed;
            left: 32px;
            bottom: 28px;
            width: min(540px, calc(100vw - 64px));
            padding: 18px 22px;
            color: #0f172a;
            background: rgba(255, 255, 255, .97);
            border-left: 8px solid #2563eb;
            border-radius: 10px;
            box-shadow: 0 12px 34px rgba(15, 23, 42, .35);
          }
          #bdd-tutorial-layer .tutorial-number {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            margin-right: 10px;
            color: white;
            background: #2563eb;
            border-radius: 50%;
            font-size: 20px;
            font-weight: 700;
          }
          #bdd-tutorial-layer .tutorial-title {
            display: inline;
            font-size: 22px;
            font-weight: 700;
          }
          #bdd-tutorial-layer .tutorial-comment {
            margin: 10px 0 0;
            font-size: 17px;
            line-height: 1.4;
          }
        \`;
        document.head.appendChild(style);

        const layer = document.createElement('div');
        layer.id = 'bdd-tutorial-layer';

        let target = null;
        let targetRect = null;
        if (step.selector) {
          target = document.querySelector(step.selector);
        } else if (step.targetText) {
          target = [...document.querySelectorAll('button, a, label, input, select, textarea, h1, h2, h3, h4, h5')]
            .find(node => (node.innerText || node.value || node.placeholder || '').trim().includes(step.targetText));
        }

        if (target) {
          target.scrollIntoView({ block: 'center', inline: 'center' });
          const rect = target.getBoundingClientRect();
          targetRect = rect;
          const padding = step.padding ?? 8;
          const focus = document.createElement('div');
          focus.className = 'tutorial-focus';
          focus.style.left = Math.max(4, rect.left - padding) + 'px';
          focus.style.top = Math.max(4, rect.top - padding) + 'px';
          focus.style.width = Math.min(window.innerWidth - 8, rect.width + padding * 2) + 'px';
          focus.style.height = Math.min(window.innerHeight - 8, rect.height + padding * 2) + 'px';
          layer.appendChild(focus);
        } else {
          const dim = document.createElement('div');
          dim.className = 'tutorial-dim';
          layer.appendChild(dim);
        }

        const card = document.createElement('div');
        card.className = 'tutorial-card';
        const number = document.createElement('span');
        number.className = 'tutorial-number';
        number.textContent = String(step.number);
        const title = document.createElement('span');
        title.className = 'tutorial-title';
        title.textContent = step.title;
        const comment = document.createElement('p');
        comment.className = 'tutorial-comment';
        comment.textContent = step.comment;
        card.append(number, title, comment);
        if (targetRect && targetRect.bottom > window.innerHeight * 0.68) {
          card.style.left = 'auto';
          card.style.right = '32px';
          card.style.top = '28px';
          card.style.bottom = 'auto';
        }
        layer.appendChild(card);
        document.body.appendChild(layer);

        return { targetFound: !step.selector && !step.targetText ? true : Boolean(target) };
      })()
    `, true);

    if (!result.targetFound) {
      throw new Error(`Élément à annoter introuvable pour l'étape ${step.number}: ${step.title}`);
    }

    await new Promise(resolve => setTimeout(resolve, 150));
    const image = await webContents.capturePage();
    const filename = `${String(step.number).padStart(2, '0')}-${step.slug}.png`;
    fs.writeFileSync(path.join(outputDir, filename), image.toPNG());
    steps.push({ ...step, image: filename });
    await removeAnnotation(webContents);
  }

  function finish() {
    const manifest = { title, introduction, generatedAt: new Date().toISOString(), steps };
    fs.writeFileSync(
      path.join(outputDir, 'tutoriel.json'),
      JSON.stringify(manifest, null, 2),
      'utf8'
    );

    const sections = steps.map(step => `
      <section class="step">
        <div class="step-heading">
          <span class="number">${step.number}</span>
          <div>
            <h2>${escapeHtml(step.title)}</h2>
            <p>${escapeHtml(step.comment)}</p>
          </div>
        </div>
        <img src="${escapeHtml(step.image)}" alt="Étape ${step.number} : ${escapeHtml(step.title)}">
      </section>
    `).join('');

    const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; font-family: Arial, sans-serif; color: #172033; background: #f4f7fb; }
    body { margin: 0; }
    header { padding: 48px 24px; color: white; background: #163b65; }
    header div, main { max-width: 1100px; margin: auto; }
    h1 { margin: 0 0 12px; font-size: clamp(30px, 5vw, 48px); }
    header p { max-width: 780px; margin: 0; font-size: 19px; line-height: 1.5; }
    main { padding: 32px 20px 64px; }
    .step { margin-bottom: 38px; padding: 24px; background: white; border-radius: 16px; box-shadow: 0 8px 28px rgba(23, 32, 51, .1); }
    .step-heading { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 18px; }
    .number { display: grid; flex: 0 0 42px; height: 42px; place-items: center; color: white; background: #2563eb; border-radius: 50%; font-size: 22px; font-weight: 700; }
    h2 { margin: 2px 0 7px; font-size: 25px; }
    .step p { margin: 0; font-size: 17px; line-height: 1.45; }
    img { display: block; width: 100%; height: auto; border: 1px solid #d9e0ea; border-radius: 10px; }
  </style>
</head>
<body>
  <header><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(introduction)}</p></div></header>
  <main>${sections}</main>
</body>
</html>`;

    fs.writeFileSync(path.join(outputDir, 'index.html'), html, 'utf8');
    return manifest;
  }

  return { captureStep, finish, removeAnnotation };
}

module.exports = { createTutorialOutput };
