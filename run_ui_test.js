const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const targetUrl = 'http://localhost:3000/';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ffmpegPath = 'C:\\Users\\user\\AppData\\Local\\ms-playwright\\ffmpeg-1011\\ffmpeg-win64.exe';
const artifactDir = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\556f01c7-4323-49af-8c80-bee4d2016ab5';
const finalVideoPath = path.join(artifactDir, 'studio_pm_test_walkthrough.mp4');

async function runTest() {
    console.log("Launching local Chrome browser in HEADFUL mode (real-time visualization)...");
    const browser = await chromium.launch({
        executablePath: chromePath,
        headless: false // <-- Set to false so you can watch the test run in real-time!
    });

    const context = await browser.newContext({
        recordVideo: {
            dir: artifactDir,
            size: { width: 1280, height: 720 }
        },
        viewport: { width: 1280, height: 720 }
    });

    const page = await context.newPage();

    // Capture console logs and page errors to identify bugs
    const logs = [];
    const errors = [];
    
    page.on('console', msg => {
        const text = msg.text();
        logs.push(`[${msg.type().toUpperCase()}] ${text}`);
        if (msg.type() === 'error') {
            errors.push(`Console error: ${text}`);
            console.error(`🔴 Console error: ${text}`);
        } else {
            console.log(`💬 Console: ${text}`);
        }
    });

    page.on('pageerror', err => {
        errors.push(`Runtime error: ${err.message}`);
        console.error(`🔴 Runtime error: ${err.stack}`);
    });

    page.on('requestfailed', req => {
        const errText = req.failure() ? req.failure().errorText : '404';
        console.warn(`⚠️ Request failed: ${req.url()} (${errText})`);
        if (!req.url().endsWith('favicon.ico')) {
            errors.push(`Failed to load resource: ${req.url()}`);
        }
    });

    try {
        console.log(`Navigating to ${targetUrl}...`);
        await page.goto(targetUrl);

        console.log("Waiting for splash screen to disappear...");
        await page.waitForSelector('#splash-screen', { state: 'hidden', timeout: 15000 });
        await page.waitForTimeout(1000);

        // 1. Create a New Project
        console.log("Creating new project...");
        const createBtn = page.locator('#btn-new-proj');
        if (await createBtn.isVisible()) {
            await createBtn.click();
        } else {
            await page.click('.new-card');
        }
        await page.waitForSelector('#np-t', { state: 'visible' });
        await page.fill('#np-t', "Swastik's Cinematic Project");
        await page.fill('#np-d', "Full scale automated test of Studio PM tools.");
        await page.click('#np-create');
        await page.waitForTimeout(1500);

        // 2. Click on the project card to navigate into it
        console.log("Selecting project card to open it...");
        await page.click('.project-card:has-text("Swastik\'s Cinematic Project")');
        await page.waitForTimeout(1500);

        // 3. Click Overview Tab
        console.log("Navigating to Overview tab...");
        await page.click('.sb-proj-nav-item[data-tab="overview"]');
        await page.waitForTimeout(1000);

        // 4. Click Visual Script Tab
        console.log("Navigating to Visual Script tab...");
        await page.click('.sb-proj-nav-item[data-tab="script"]');
        await page.waitForTimeout(1000);
        
        console.log("Adding visual script block...");
        await page.click('#vs-add-btn');
        await page.waitForTimeout(500);
        const textareas = page.locator('.vs-textarea');
        const count = await textareas.count();
        if (count > 0) {
            await textareas.nth(count - 1).fill("Scene 1: Swastik's room. Typing commands into the AI assistant.");
        }
        await page.waitForTimeout(1500);

        // 5. Click Project Board Tab
        console.log("Navigating to Project Board tab...");
        await page.click('.sb-proj-nav-item[data-tab="board"]');
        await page.waitForTimeout(1500);

        console.log("Testing Project Board tools...");
        // Add a Text block
        await page.click('.tool-btn[data-tool="text"]');
        const board = page.locator('#board-container');
        const boardBox = await board.boundingBox();
        const clickX = boardBox.x + 300;
        const clickY = boardBox.y + 200;
        await page.mouse.click(clickX, clickY);
        await page.waitForTimeout(500);
        await page.keyboard.type("Automated Board Item");
        await page.waitForTimeout(1000);

        // Draw with Pencil tool
        await page.click('.tool-btn[data-tool="pencil"]');
        await page.waitForTimeout(500);
        await page.mouse.move(boardBox.x + 350, boardBox.y + 350);
        await page.mouse.down();
        await page.mouse.move(boardBox.x + 400, boardBox.y + 400, { steps: 5 });
        await page.mouse.move(boardBox.x + 450, boardBox.y + 350, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(1000);

        // Undo & Redo
        console.log("Testing Undo/Redo...");
        await page.click('#board-undo');
        await page.waitForTimeout(800);
        await page.click('#board-redo');
        await page.waitForTimeout(1000);

        // Clear Board
        console.log("Testing Clear Board...");
        await page.click('#board-clear');
        await page.waitForSelector('#confirm-go');
        await page.click('#confirm-go');
        await page.waitForTimeout(1500);

        // 6. Click Shots Tab
        console.log("Navigating to Shots tab...");
        await page.click('.sb-proj-nav-item[data-tab="shots"]');
        await page.waitForTimeout(1000);

        console.log("Creating new shot...");
        await page.click('#new-shot-btn');
        await page.waitForSelector('#prompt-input');
        await page.fill('#prompt-input', "Interior Workspace Setup");
        await page.click('#prompt-confirm');
        await page.waitForTimeout(1500);

        console.log("Opening Shot Details...");
        await page.click('.shot-card-revamp');
        await page.waitForSelector('#sd-back');
        await page.waitForTimeout(1000);

        console.log("Toggling type and adding tasks...");
        await page.click('#btn-2d');
        await page.waitForSelector('#confirm-go');
        await page.click('#confirm-go');
        await page.waitForTimeout(800);
        await page.click('#btn-3d');
        await page.waitForSelector('#confirm-go');
        await page.click('#confirm-go');
        await page.waitForTimeout(800);

        await page.click('#new-task-btn');
        await page.waitForSelector('#prompt-input');
        await page.fill('#prompt-input', "Position cameras and check angles");
        await page.click('#prompt-confirm');
        await page.waitForTimeout(1000);

        console.log("Adding and reverting a Shot Idea...");
        await page.click('#add-idea-btn');
        await page.waitForSelector('#prompt-input');
        await page.fill('#prompt-input', "Use a custom neon lamp asset");
        await page.click('#prompt-confirm');
        await page.waitForTimeout(1000);

        // Revert it (deleting the shot idea should push it to project global ideas list)
        await page.click('.idea-del-btn');
        await page.waitForTimeout(1000);

        // Go back
        await page.click('#sd-back');
        await page.waitForTimeout(1000);

        // 7. Navigation
        console.log("Navigating sidebar workspace levels...");
        await page.click('#sb-allideas');
        await page.waitForTimeout(1000);
        
        await page.click('#sb-trash');
        await page.waitForTimeout(1000);

        await page.click('#sb-home');
        await page.waitForTimeout(1500);

        console.log("Test sequence completed successfully!");

    } catch (err) {
        console.error("Test execution failed:", err);
        errors.push(`Test execution failed: ${err.message}`);
    } finally {
        // Retrieve video path before closing
        const video = page.video();
        let videoPath = null;
        if (video) {
            videoPath = await video.path();
            console.log("Video captured at temporary path:", videoPath);
        }

        console.log("Closing browser...");
        await context.close();
        await browser.close();

        // Handle video conversion to MP4 for maximum compatibility
        if (videoPath && fs.existsSync(videoPath)) {
            try {
                if (fs.existsSync(finalVideoPath)) {
                    fs.unlinkSync(finalVideoPath);
                }
                
                console.log("Converting video from WebM to MP4 using FFmpeg...");
                execSync(`"${ffmpegPath}" -i "${videoPath}" -c:v libx264 -pix_fmt yuv420p "${finalVideoPath}"`, { stdio: 'inherit' });
                console.log(`Video successfully converted to MP4 and saved to: ${finalVideoPath}`);
                
                // Remove the raw WebM file to save space
                fs.unlinkSync(videoPath);
            } catch (convErr) {
                console.error("Error converting video to MP4:", convErr);
                // Fallback: Copy WebM to final destination if ffmpeg fails
                const fallbackWebmPath = finalVideoPath.replace('.mp4', '.webm');
                try {
                    fs.copyFileSync(videoPath, fallbackWebmPath);
                    console.log(`Fallback: WebM saved to ${fallbackWebmPath}`);
                } catch(copyErr) {
                    console.error("Fallback copy failed:", copyErr);
                }
            }
        }

        // Output error report for walkthrough
        const results = {
            success: errors.length === 0,
            errors: errors,
            logs: logs
        };
        fs.writeFileSync(path.join(artifactDir, 'test_results.json'), JSON.stringify(results, null, 4));
        console.log("Test results log saved.");
    }
}

runTest();
