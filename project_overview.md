# Welcome to Ilaara: Your Bespoke Digital Boutique

Welcome to your new digital home. Ilaara is a high-performance, custom-built e-commerce platform designed exclusively for your handmade crochet and polaroid art. 

Unlike off-the-shelf templates (like Shopify or Wix), your platform has been built from the ground up to provide a premium, editorial, and magazine-like experience for your customers. It is designed to feel slow, intimate, and highly curated.

This document serves as your complete guide to what your platform is, how it works, what features you have, and the critical rules you must follow to keep your business safe and profitable.

---

## 🌟 1. The Customer Experience (What Your Visitors See)

When a customer lands on `ilaara.com`, they aren't greeted by a generic shopping grid. They enter a curated gallery.

### The Home Page: "Scrollytelling"
The homepage is designed to tell your brand's story. As the user scrolls down, hand-drawn art elements float in the background (parallax effects), and text gently fades into view. It is built to make the customer slow down and appreciate the craftsmanship of your work before they ever see a price tag.

### The Shop Page: The Collection
Instead of a rigid store, your shop acts like a pinterest board.
*   **The Grid:** It features beautiful, large photography.
*   **Categories:** Customers can easily bounce between "All Pieces," "Crochet," and "Polaroids" using satisfying animated filter buttons.

### Product Details: The Editorial View
When a customer clicks on a product, they are taken to a high-end editorial page.
*   It highlights the "Key Features" of your craft (e.g., Pure Material, Artisanal Craft).
*   It features an interactive image gallery to show off your products from every angle.
*   If an item is out of stock, the button elegantly switches to a "Sold Out" state.

### Checkout & Payments
Customers add items to a slide-out cart. When ready, they proceed to checkout.
*   **Razorpay Integration:** Your store is fully integrated with Razorpay. Customers can pay via UPI, Credit Card, or NetBanking natively without ever feeling like they left your boutique.

---

## 👩‍💻 2. The Command Center (What YOU Control)

A protected admin dashboard is available to authorized users for managing inventory, orders, and site content.

### A. Managing Your Inventory
In the **Products** tab, you can add new drops, upload images, set prices, and control stock. When an item runs out, uncheck "Available" and your storefront will automatically update.

### B. Handling Orders & Enquiries
*   When a customer buys something, the order immediately drops into your **Orders** tab with their shipping address and payment status.
*   If someone uses the contact form, it lands directly in your **Enquiries** tab for you to read.

### C. The Visual Engine (Customize Tab)
You have total control over what your website looks like. You don't need a developer to change the vibe of your store:
*   **Colors:** Change the exact background and text colors. Give the site a dark mode for winter, and a light mode for summer.
*   **Layouts:** Change the shop grid from 2 columns to 4 columns. 
*   **Animations:** Make the homepage text scroll faster or slower based on your preference.
*   **Safety Net:** If you ruin the design by pushing random buttons, just click the **"Revert to Original"** button in the corner, and it will instantly repair the site.

---

## 🛡️ 3. Security & Privacy Features (Built for You)

Because you run a personal brand, we built military-grade security into the background:

*   **Location Protection (EXIF Stripping):** When you take a raw photo on your iPhone, the photo invisibly stores the exact GPS location of your home or studio. When you upload a photo to Ilaara, **our server immediately deletes those GPS coordinates** before anyone on the internet can see it.
*   **Spam Executioners:** Your contact and checkout forms have "invisible honeypots." Spam-bots try to fill these out, fall into the trap, and are destroyed before they ever email you.
*   **The Shield Dashboard:** In your admin panel, you can view a live feed of who is trying to log in and if anyone is trying to breach your system.

---

## 🚫 4. CRITICAL RULES (How to NOT Get Scammed or Billed)

Your platform runs on extremely fast, professional cloud infrastructure. Think of it like driving a Ferrari—it is incredibly powerful, but you must wear a seatbelt. **Follow these rules exactly.**

### Rule #1: Image Sizes (The Cloudinary Bill Rule)
*   **What it is:** Your images are hosted on a lightning-fast premium network called Cloudinary. You get a certain amount of free "bandwidth" every month.
*   **The Danger:** If you upload massive, uncompressed 25MB RAW images from a professional camera, every time a customer loads your page, it eats your bandwidth. This will drain your free quota in days and trigger massive overage bills.
*   **The Solution:** You MUST lightly compress your images before uploading. Use a free tool like TinyPNG (tinypng.com), or export images from your phone/camera as standard JPEGs (under 1MB each). 

### Rule #2: Traffic Spikes (The Spend Cap Rule)
*   **What it is:** If a famous influencer posts your link, your "Vercel" and "Supabase" servers will automatically duplicate themselves instantly to handle the 100,000 visitors without crashing.
*   **The Danger:** If your traffic spikes unimaginably high, they will charge you for the extra servers.
*   **The Solution:** Always verify that "Spend Caps" and "Usage Limits" are turned ON in your Vercel and Supabase billing dashboards. Do not turn them off unless you are intentionally expecting to pay for massive viral traffic.

### Rule #3: Protect Your Credentials
*   **What it is:** Your Admin login gives you the power to change bank details, Razorpay webhooks, and prices.
*   **The Danger:** Scammers scrape the internet for passwords. If they get yours, they can intercept payments.
*   **The Solution:** Never log in on a public computer. Never share your password. Never put your database keys (from the `.env.local` file) anywhere on the internet or send them in an Instagram DM.

### Rule #4: The Visibility Check
*   **What it is:** You have the power to change the colors of your site instantly via the Customize tab.
*   **The Danger:** You can accidentally set the background to White, and the text to White. You will blind your users.
*   **The Solution:** Always check your site on your mobile phone *immediately* after you make a visual change to ensure buttons ("Add to Cart") are readable. Use the "Revert to Original" button if you lose sight of the menu.
