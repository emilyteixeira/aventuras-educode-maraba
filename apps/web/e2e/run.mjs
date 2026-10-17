// Ensaio ponta a ponta: 1 tutor + 3 alunos jogam a Era 1 inteira num Chromium real.
// Pré-requisito: API em BASE_URL (padrão http://localhost:8000) com apps/web/dist compilado.
//   TUTOR_CODE / CLASS_CODE devem bater com o servidor (ver apps/api/scripts/dev_server.py).
import { chromium } from "playwright-core";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:8000";
const TUTOR_CODE = process.env.TUTOR_CODE ?? "TUTOR-ENSAIO";
const CLASS_CODE = process.env.CLASS_CODE ?? "TURMA-ENSAIO";
const SHOTS = process.env.SHOTS_DIR ?? "e2e/shots";
const CHROME = process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
mkdirSync(SHOTS, { recursive: true });

const problems = [];
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const stamp = Date.now().toString(36);

async function newUser(browser, name, viewport, mobile = false) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, locale: "pt-BR" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", (e) => problems.push(`[${name}] pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource.*(401|404)/.test(m.text())) problems.push(`[${name}] console.error: ${m.text()}`);
  });
  return { name, ctx, page };
}

async function register(u, role) {
  const p = u.page;
  await p.goto(`${BASE}/entrar`);
  await p.getByRole("tab", { name: "Criar conta" }).click();
  await p.getByLabel("Apelido de aventureiro").fill(u.name);
  await p.getByLabel("E-mail (Gmail)").fill(`${u.name.toLowerCase()}.${stamp}@gmail.com`);
  await p.getByLabel("Senha").fill("senha-segura-123");
  await p.getByLabel("Código da turma").fill(role === "tutor" ? TUTOR_CODE : CLASS_CODE);
  await p.getByRole("button", { name: "Criar e começar" }).click();
}

async function axeCheck(u, label) {
  const p = u.page;
  await p.addScriptTag({ content: AXE });
  const res = await p.evaluate(async () => {
    // @ts-ignore
    const r = await axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help, targets: v.nodes.map((n) => n.target.join(" ") + " :: " + (n.any[0]?.message ?? "")) }));
  });
  if (res.length) {
    log(`axe [${u.name}/${label}]`, JSON.stringify(res));
    for (const v of res) problems.push(`a11y ${u.name}/${label}: ${v.id} (${v.impact}) x${v.nodes}`);
  }
}

async function onboarding(u, cls, shot) {
  const p = u.page;
  await p.waitForURL("**/onboarding");
  await p.getByRole("button", { name: new RegExp(cls) }).first().click();
  if (shot) {
    await p.screenshot({ path: `${SHOTS}/${u.name}-onboarding-edu.png` });
    await axeCheck(u, "onboarding");
  }
  await p.getByRole("button", { name: "Próximo" }).click();
  await p.locator(".tool-card", { hasText: "Livro" }).click();
  await p.locator(".tool-card", { hasText: "Lupa" }).click();
  if (shot) await p.screenshot({ path: `${SHOTS}/${u.name}-onboarding-armas.png` });
  await p.getByRole("button", { name: "Próximo" }).click(); // cenário
  await p.getByRole("button", { name: "Próximo" }).click(); // mundo
  await p.getByRole("button", { name: "Próximo" }).click(); // tutores
  await p.getByRole("button", { name: "Entrar no mundo!" }).click();
  await p.waitForURL("**/jogar");
}

const clean = (s) => s.replace(/\s+✓\s*$/, "").trim();

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const tutor = await newUser(browser, "Emily", { width: 1366, height: 768 });
  const students = [
    await newUser(browser, "Ana", { width: 390, height: 844 }, true),
    await newUser(browser, "Bruno", { width: 1366, height: 768 }),
    await newUser(browser, "Carla", { width: 1024, height: 768 }),
  ];

  // --- tutor cria a sala
  await register(tutor, "tutor");
  await tutor.page.waitForURL("**/tutor");
  await tutor.page.getByRole("button", { name: /Criar sala/ }).click();
  await tutor.page.waitForSelector(".code-big");
  const code = (await tutor.page.locator(".code-big").innerText()).trim();
  log("sala", code);
  await tutor.page.getByLabel(/Avançar sozinho/).click(); // estado vem do servidor: espera o eco
  await tutor.page.waitForFunction(() => !document.querySelector("input[type=checkbox]").checked);

  // --- alunos: cadastro, onboarding, entrar na sala
  const classes = ["Paladino", "Mago", "Robô"];
  for (const [i, u] of students.entries()) {
    await register(u, "student");
    await onboarding(u, classes[i], i < 2);
    await u.page.getByLabel(/Código da sala/).fill(code);
    await u.page.getByRole("button", { name: "Entrar na sala" }).click();
    await u.page.waitForURL(`**/sala/${code}`);
    await u.page.getByText(/Você entrou/).waitFor();
  }
  await students[0].page.screenshot({ path: `${SHOTS}/Ana-lobby.png` });
  await axeCheck(students[0], "lobby");

  // persistência: recarregar a página mantém a sessão e o personagem
  await students[1].page.reload();
  await students[1].page.getByText(/Você entrou/).waitFor();

  await tutor.page.getByRole("button", { name: /Sortear grupos/ }).click();
  await tutor.page.getByRole("button", { name: /Iniciar Era 1/ }).click();
  await students[0].page.screenshot({ path: `${SHOTS}/Ana-intro.png` });

  const T = tutor.page;
  let questionNo = 0;
  for (let m = 1; m <= 5; m++) {
    for (const u of students) await u.page.locator(".mission-banner").waitFor();
    if (m === 1) await axeCheck(students[0], "intro");
    await T.getByRole("button", { name: "Começar missão ▶" }).click();
    for (let q = 1; q <= 4; q++) {
      questionNo++;
      await T.getByText(new RegExp(`Pergunta ${q}/4`)).waitFor();
      const prompt = (await T.locator(".qprompt").last().innerText()).trim();
      const isOrder = (await T.getByText(/Ordem certa:/).count()) > 0;
      let correct;
      if (isOrder) correct = (await T.getByText(/Ordem certa:/).innerText()).replace("Ordem certa:", "").split("→").map((x) => x.trim());
      else correct = clean(await T.locator("li:has-text('✓')").first().innerText());

      for (const [i, u] of students.entries()) {
        const p = u.page;
        await p.locator(".qprompt", { hasText: prompt.slice(0, 25) }).waitFor();
        if (questionNo === 1 && i === 0) {
          await p.getByRole("button", { name: /Lupa/ }).click();
          await p.locator(".opt.gone").first().waitFor();
          await p.getByRole("button", { name: /Livro/ }).click();
          await p.locator(".clue").first().waitFor();
          await p.screenshot({ path: `${SHOTS}/Ana-pergunta-ferramentas.png` });
          await axeCheck(u, "pergunta");
        }
        const wrong = i === 2 && questionNo % 3 === 0; // Carla erra uma a cada três
        if (isOrder) {
          const seq = wrong ? [...correct].reverse() : correct;
          for (const t of seq) await p.locator(".order-item", { hasText: t }).first().click();
          await p.getByRole("button", { name: "Enviar ordem" }).click();
        } else if (wrong) {
          const opts = p.locator(".opt:not(.gone)");
          const n = await opts.count();
          for (let k = 0; k < n; k++) {
            const txt = await opts.nth(k).innerText();
            if (!txt.includes(correct)) {
              await opts.nth(k).click();
              break;
            }
          }
        } else {
          await p.locator(".opt").filter({ has: p.getByText(correct, { exact: true }) }).click();
        }
      }
      for (const u of students) await u.page.locator(".success, .error").filter({ hasText: /Acertou|Não foi dessa vez|Sem resposta/ }).waitFor();
      if (questionNo === 1) {
        await students[0].page.screenshot({ path: `${SHOTS}/Ana-reveal.png` });
        await students[1].page.screenshot({ path: `${SHOTS}/Bruno-reveal.png` });
        await axeCheck(students[0], "reveal");
      }
      if (questionNo === 3) await students[1].page.screenshot({ path: `${SHOTS}/Bruno-ordenar.png` });
      await T.getByRole("button", { name: "Próxima ▶", exact: true }).click();
      if (q < 4) await T.locator(".timer").waitFor();
    }
    for (const u of students) await u.page.locator(".podium").first().waitFor();
    log("missão", m, "ok · pódio");
    if (m === 1 || m === 5) {
      await students[0].page.screenshot({ path: `${SHOTS}/Ana-podio-m${m}.png` });
      await students[1].page.screenshot({ path: `${SHOTS}/Bruno-podio-m${m}.png` });
    }
    if (m === 1) await axeCheck(students[0], "podio");
    await T.getByRole("button", { name: m === 5 ? "Abrir o selo ▶" : "Próxima missão ▶" }).click();
  }

  // --- selo: errar primeiro, depois acertar com alguém do grupo
  for (const u of students) await u.page.getByRole("heading", { name: "O Selo da Era 1" }).waitFor();
  const a = students[0].page;
  const inputs = a.locator(".blanks input");
  for (const [i, w] of ["x", "y", "z", "w"].entries()) await inputs.nth(i).fill(w);
  await a.getByRole("button", { name: "Decifrar o selo" }).click();
  await a.getByText(/0 de 4 lacunas/).waitFor();
  await a.screenshot({ path: `${SHOTS}/Ana-selo-errado.png` });
  await axeCheck(students[0], "selo");
  await a.waitForTimeout(3200); // espera o tempo de espera entre tentativas
  for (const [i, w] of ["dividir", "Padrão", "essencial", "passos"].entries()) await inputs.nth(i).fill(w);
  await a.getByRole("button", { name: "Decifrar o selo" }).click();
  await a.getByText("O Selo do Cartógrafo").waitFor();
  await a.screenshot({ path: `${SHOTS}/Ana-recompensa.png` });
  // colegas do mesmo grupo veem a recompensa sem digitar
  const group = await T.locator(".lb li", { hasText: "🔓" }).count();
  log("grupos com selo aberto:", group);
  await T.screenshot({ path: `${SHOTS}/Emily-painel-selo.png` });
  await T.getByRole("button", { name: "Encerrar sala" }).click();
  await students[1].page.getByRole("heading", { name: "Fim da Era 1!" }).waitFor();
  await students[1].page.screenshot({ path: `${SHOTS}/Bruno-final.png` });

  // --- persistência: login de novo
  const again = await newUser(browser, "Ana2", { width: 390, height: 844 }, true);
  await again.page.goto(`${BASE}/entrar`);
  await again.page.getByLabel("E-mail (Gmail)").fill(`ana.${stamp}@gmail.com`);
  await again.page.getByLabel("Senha").fill("senha-segura-123");
  await again.page.getByRole("button", { name: "Entrar", exact: true }).last().click();
  await again.page.waitForURL("**/jogar");
  await again.page.locator("svg.edu").first().waitFor();
  await again.page.screenshot({ path: `${SHOTS}/Ana-login-persistente.png` });

  await browser.close();
  console.log("\n=== RESULTADO ===");
  if (problems.length) {
    console.log("PROBLEMAS:\n" + [...new Set(problems)].join("\n"));
    process.exitCode = 1;
  } else console.log("OK: aula simulada completa, sem erros de console nem violações de acessibilidade.");
}

main().catch((e) => {
  console.error("FALHOU:", e);
  console.log([...new Set(problems)].join("\n"));
  process.exit(2);
});
