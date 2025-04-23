/* eslint-disable no-console */
/**
 * Benchmark utility for the Power BI template generator.
 * Runs the generator against all mock scenarios and records
 * execution time, CPU usage, memory consumption, and output size.
 *
 * Usage: `node src/benchmark/templateGeneratorBenchmark.js`
 */
const path = require('path');
const fs = require('fs-extra');
const { performance } = require('perf_hooks');
const os = require('os');

const { listScenarios, loadMock, scenariosDir } = require('../mock/mockLoader');
const { generatePbit } = require('../generators/pbitGenerator');

const OUTPUT_DIR = path.join(__dirname, '../../output/benchmarks');

async function benchmark() {
  const scenarios = listScenarios();
  if (scenarios.length === 0) {
    console.error('No mock scenarios found in', scenariosDir);
    process.exit(1);
  }

  await fs.ensureDir(OUTPUT_DIR);
  const report = {
    timestamp: new Date().toISOString(),
    node: process.version,
    platform: `${os.type()} ${os.release()} (${os.arch()})`,
    results: [],
  };

  console.log('Benchmarking template generator with scenarios:', scenarios.join(', '));

  for (const name of scenarios) {
    const data = loadMock(name, true);
    const outPath = path.join(OUTPUT_DIR, `${name}.pbit`);

    // Baseline metrics
    const memStart = process.memoryUsage().rss;
    const cpuStart = process.cpuUsage();
    const t0 = performance.now();

    try {
      await generatePbit(data, outPath);
    } catch (err) {
      console.error(`❌  Generation failed for ${name}:`, err.message || err);
      report.results.push({ scenario: name, error: err.message || String(err) });
      continue;
    }

    const t1 = performance.now();
    const cpuEnd = process.cpuUsage(cpuStart); // returns diff
    const memEnd = process.memoryUsage().rss;

    const size = (await fs.stat(outPath)).size;

    const entry = {
      scenario: name,
      durationMs: +(t1 - t0).toFixed(2),
      cpuUserMs: cpuEnd.user / 1000, // microseconds to ms
      cpuSystemMs: cpuEnd.system / 1000,
      memoryDeltaMB: +((memEnd - memStart) / (1024 * 1024)).toFixed(2),
      outputSizeBytes: size,
    };
    report.results.push(entry);

    console.log(
      `✅  ${name}: time ${entry.durationMs} ms, mem Δ ${entry.memoryDeltaMB} MB, ` +
        `CPU (user+sys) ${(entry.cpuUserMs + entry.cpuSystemMs).toFixed(2)} ms, size ${size} bytes`
    );
  }

  const reportPath = path.join(OUTPUT_DIR, `benchmark_${Date.now()}.json`);
  await fs.writeJson(reportPath, report, { spaces: 2 });
  console.log('\nBenchmark report saved to', path.relative(process.cwd(), reportPath));
}

benchmark().catch((e) => {
  console.error('Benchmark run failed:', e);
  process.exit(1);
});
