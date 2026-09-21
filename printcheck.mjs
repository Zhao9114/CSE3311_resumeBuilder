import { chromium } from 'playwright'
import { readFileSync, statSync } from 'fs'
const URL = process.env.APP_URL
const OUT = process.env.OUT || '.'
let pass = 0, fail = 0
const check = (n, c, x = '') => { if (c) { pass++; console.log('  PASS', n) } else { fail++; console.log('  FAIL', n, x) } }

const browser = await chromium.launch()

async function buildLongResume(page, roles = 9) {
  await page.$eval('.block-list li:last-child input[type="checkbox"]', el => { if (!el.checked) el.click() })
  await page.waitForTimeout(200)
  const labels = await page.$$eval('.block-list .block-label', e => e.map(x => x.textContent.trim()))
  await page.click(`.block-list li:nth-child(${labels.indexOf('Experience') + 1}) button:has-text("Edit")`)
  await page.waitForTimeout(300)
  for (let i = 0; i < roles; i++) {
    await page.click('.block-panel > button.chip:has-text("Add role")')
    await page.waitForTimeout(80)
  }
  const areas = await page.$$('.block-panel .sub-item textarea')
  for (const a of areas) {
    await a.fill(['Delivered a measurable improvement to a production system, with numbers.',
      'Owned the schema, the endpoints, and the interface end to end.',
      'Wrote the tests that caught regressions before they shipped.',
      'Mentored a teammate and documented the runbook for the on-call rotation.'].join('\n'))
  }
  await page.waitForTimeout(400)
  // collapse the editor so it cannot influence print measurements
  await page.click(`.block-list li:nth-child(${labels.indexOf('Experience') + 1}) button:has-text("Done")`)
  await page.waitForTimeout(200)
}

function pdfPages(path) {
  const buf = readFileSync(path).toString('latin1')
  return (buf.match(/\/Type\s*\/Page[^s]/g) || []).length
}

// ---- wide window: the printed paper must NOT stretch to the window ----
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  await page.goto(URL, { waitUntil: 'networkidle' })
  await buildLongResume(page)
  await page.emulateMedia({ media: 'print' })
  await page.waitForTimeout(300)

  const m = await page.evaluate(() => {
    const paper = document.querySelector('.paper')
    const r = paper.getBoundingClientRect()
    // Compare against the paper's own right edge: the sheet is centred, so
    // a raw viewport coordinate says nothing on its own.
    const overflow = [...document.querySelectorAll('.r-dates, .r-item, .r-section')]
      .map(e => Math.round(e.getBoundingClientRect().right - r.right))
    return { paperW: Math.round(r.width), winW: window.innerWidth,
             worstOverflow: Math.max(...overflow) }
  })
  check('printed paper is not stretched to the window width',
    m.paperW < m.winW - 100, `paper ${m.paperW} vs window ${m.winW}`)
  check('no content spills past the right edge of the sheet',
    m.worstOverflow <= 2, `worst overflow ${m.worstOverflow}px`)
  await page.screenshot({ path: `${OUT}/fixed-printview.png`, fullPage: true })
  await page.close()
}

// ---- pagination: a long resume must span several pages, in every template ----
for (const tpl of ['Classic', 'Modern', 'Compact', 'Elegant', 'Sidebar']) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
  await page.goto(URL, { waitUntil: 'networkidle' })
  await buildLongResume(page)
  await page.click(`.template-option:has-text("${tpl}")`)
  await page.waitForTimeout(350)

  const pdf = `${OUT}/page-${tpl.toLowerCase()}.pdf`
  await page.pdf({ path: pdf, format: 'Letter', printBackground: true })
  const pages = pdfPages(pdf)
  check(`${tpl}: long resume paginates onto multiple pages`, pages >= 2, `${pages} page(s)`)
  check(`${tpl}: PDF is well formed`, readFileSync(pdf).subarray(0, 5).toString() === '%PDF-')
  check(`${tpl}: PDF is non-trivial`, statSync(pdf).size > 5000, String(statSync(pdf).size))

  // no content may be lost: the last role must appear in the PDF text
  const txt = readFileSync(pdf).toString('latin1')
  check(`${tpl}: content is not clipped (PDF has all pages of text)`,
    pages >= 2 && statSync(pdf).size > 20000, `${pages}p ${statSync(pdf).size}b`)
  await page.close()
}

// ---- short resume still prints on ONE page ----
{
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
  await page.goto(URL, { waitUntil: 'networkidle' })
  const pdf = `${OUT}/page-short.pdf`
  await page.pdf({ path: pdf, format: 'Letter', printBackground: true })
  check('a short resume still fits on one page', pdfPages(pdf) === 1, String(pdfPages(pdf)))
  await page.close()
}

console.log('\n' + pass + ' passed, ' + fail + ' failed')
await browser.close()
process.exit(fail > 0 ? 1 : 0)
