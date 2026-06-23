from playwright.sync_api import sync_playwright
import os

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.on("console", lambda msg: print(f"CONSOLE {msg.type}: {msg.text}"))
    page.on("pageerror", lambda err: print(f"ERROR: {err}"))
    page.goto(f"file:///{os.path.abspath('index.html')}")
    page.wait_for_timeout(2000)
    browser.close()
