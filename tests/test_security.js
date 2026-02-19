const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const scoreScript = path.join(__dirname, '..', 'scoring', 'score.js');
const rootDir = path.join(__dirname, '..');
const resultsDir = path.join(rootDir, 'results');

// Setup test files
const secretFile = path.join(rootDir, 'secret.json');
const validFile = path.join(resultsDir, 'valid.json');

// Ensure files exist
if (!fs.existsSync(secretFile)) {
    fs.writeFileSync(secretFile, JSON.stringify([{ secret: "exposed" }]));
}
if (!fs.existsSync(validFile)) {
    fs.writeFileSync(validFile, JSON.stringify([{ completed: true, task_name: "test", model_id: "test" }]));
}

console.log("Running security tests...");

let passed = true;

function runTestCase(args, description, expectSuccess) {
    console.log(`\nTest: ${description}`);
    const result = spawnSync('node', [scoreScript, ...args], { cwd: rootDir, encoding: 'utf-8' });

    const output = result.stdout + result.stderr;

    const errorMsg = "Invalid results file path";

    if (expectSuccess) {
        if (output.includes("BISHOP BENCHMARK RESULTS") && !output.includes(errorMsg)) {
            console.log("✅ Passed (Success as expected)");
            return true;
        } else {
            console.error("❌ Failed (Expected success, got error or no results)");
            console.error("Output snippet:", output.substring(0, 200) + "...");
            return false;
        }
    } else {
        if (output.includes(errorMsg)) {
            console.log("✅ Passed (Blocked as expected)");
            return true;
        } else {
            console.error("❌ Failed (Expected block, but didn't see error message)");
            console.error("Output snippet:", output.substring(0, 200) + "...");
            return false;
        }
    }
}

// Test 1: secret.json (in root)
passed = runTestCase(['--results', 'secret.json'], "Access secret.json (root)", false) && passed;

// Test 2: valid.json (in results)
passed = runTestCase(['--results', 'results/valid.json'], "Access results/valid.json", true) && passed;

// Test 3: Traversal (results/../secret.json)
passed = runTestCase(['--results', 'results/../secret.json'], "Access results/../secret.json", false) && passed;

// Test 4: Absolute path to secret.json
passed = runTestCase(['--results', secretFile], "Access absolute path to secret.json", false) && passed;

// Test 5: Absolute path to valid.json
passed = runTestCase(['--results', validFile], "Access absolute path to valid.json", true) && passed;


if (passed) {
    console.log("\nAll security tests passed! 🛡️");
    process.exit(0);
} else {
    console.error("\nSome tests failed.");
    process.exit(1);
}
