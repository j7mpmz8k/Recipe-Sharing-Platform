// scripts/pull_prod_db.js
import 'dotenv/config';
import { spawn } from 'child_process';
import readline from 'readline';

function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((resolve) => {
        rl.question(query, (ans) => {
            rl.close();
            resolve(ans.trim());
        });
    });
}

function parseCliArgs() {
    const args = process.argv.slice(2);
    const parsed = {
        sshHost: "",
        prodDb: "",
        prodUser: "",
        localDb: "",
        autoConfirm: false
    };

    let i = 0;
    while (i < args.length) {
        const arg = args[i];
        if (arg === "--yes" || arg === "-y") {
            parsed.autoConfirm = true;
        } else if (arg === "--host" || arg === "-h") {
            i = i + 1;
            parsed.sshHost = args[i] || "";
        } else if (arg === "--prod-db") {
            i = i + 1;
            parsed.prodDb = args[i] || "";
        } else if (arg === "--prod-user") {
            i = i + 1;
            parsed.prodUser = args[i] || "";
        } else if (arg === "--local-db") {
            i = i + 1;
            parsed.localDb = args[i] || "";
        } else if (!parsed.sshHost && !arg.startsWith("-")) {
            parsed.sshHost = arg;
        }
        i = i + 1;
    }

    return parsed;
}

async function main() {
    const cli = parseCliArgs();

    let sshHost = cli.sshHost || process.env.PROD_SSH_HOST || "";
    let prodDb = cli.prodDb || process.env.PROD_DB_NAME || "recipe_db";
    let prodUser = cli.prodUser || process.env.PROD_DB_USER || "postgres";
    let localDb = cli.localDb || process.env.DB_NAME || "recipe_db_staging";
    let localUser = process.env.DB_USER || "admin";
    let localHost = process.env.DB_HOST || "localhost";
    let localPort = process.env.DB_PORT || "5432";

    console.log("==================================================");
    console.log("   Recipe Sharing Platform - Database Sync Tool   ");
    console.log("==================================================");

    if (!sshHost) {
        console.log("\nNo production SSH host specified.");
        sshHost = await askQuestion("Enter production SSH host (e.g. user@your-server-ip): ");
        if (!sshHost) {
            console.error("\n[Error] Production SSH host is required. Aborted.");
            process.exit(1);
        }
    }

    console.log("\nSync Configuration:");
    console.log(`  Source (Remote):  ${prodUser}@${sshHost} -> Database: "${prodDb}"`);
    console.log(`  Target (Local):   ${localUser}@${localHost}:${localPort} -> Database: "${localDb}"`);
    console.log("  Method:           Direct SSH Stream (pg_dump | psql)");

    if (!cli.autoConfirm) {
        console.log("\n⚠️  WARNING: This will overwrite your local staging database with production data.");
        const answer = await askQuestion("Are you sure you want to proceed? (y/N): ");
        const lowerAnswer = answer.toLowerCase();
        if (lowerAnswer !== "y" && lowerAnswer !== "yes") {
            console.log("\nOperation canceled by user.");
            process.exit(0);
        }
    }

    console.log("\nStreaming database from production to local staging...");
    const startTime = Date.now();

    const pgDumpRemoteCmd = `pg_dump -U ${prodUser} -d ${prodDb} --clean --if-exists --no-owner --no-privileges`;
    const sshArgs = [sshHost, pgDumpRemoteCmd];

    const psqlArgs = [
        "-h", localHost,
        "-p", localPort,
        "-U", localUser,
        "-d", localDb
    ];

    const psqlEnv = {
        ...process.env,
        PGPASSWORD: process.env.DB_PASSWORD || ""
    };

    const sshProcess = spawn("ssh", sshArgs, {
        stdio: ["inherit", "pipe", "inherit"]
    });

    const psqlProcess = spawn("psql", psqlArgs, {
        stdio: ["pipe", "inherit", "inherit"],
        env: psqlEnv
    });

    sshProcess.stdout.pipe(psqlProcess.stdin);

    let failed = false;

    sshProcess.on("error", (err) => {
        failed = true;
        console.error("\n[SSH Error]:", err.message);
    });

    psqlProcess.on("error", (err) => {
        failed = true;
        console.error("\n[PSQL Error]:", err.message);
    });

    sshProcess.on("close", (code) => {
        if (code !== 0) {
            failed = true;
            console.error(`\n[SSH Error]: Remote pg_dump command exited with code ${code}.`);
        }
    });

    psqlProcess.on("close", (code) => {
        if (code === 0 && !failed) {
            const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`\n✓ Database successfully synced from production to "${localDb}" in ${durationSec}s!`);
            process.exit(0);
        } else {
            console.error(`\n[PSQL Error]: Local restore exited with code ${code}.`);
            process.exit(1);
        }
    });
}

main().catch((err) => {
    console.error("\nUnexpected error:", err);
    process.exit(1);
});
