# Book Butterfly — Setup Guide for Parents

This guide takes about 15 minutes. You will need to fill in 5 values in `config.js`.

---

## Step 1 — Get an Anthropic API Key (the "brain" of Book Butterfly)

1. Go to **https://console.anthropic.com** and sign up for a free account.
2. Once logged in, click **"API Keys"** in the left sidebar.
3. Click **"Create Key"**, give it a name like "Book Butterfly", then click **Create**.
4. Copy the key that appears (it starts with `sk-ant-`). **Save it somewhere safe — you won't see it again.**
5. You will need to add a payment method and load a small credit balance (a few dollars covers thousands of book checks).

---

## Step 2 — Set Up EmailJS (sends your child's messages to your inbox)

EmailJS lets the app send you emails without a server. It's free for up to 200 emails/month.

1. Go to **https://www.emailjs.com** and create a free account.
2. After signing in, click **"Email Services"** on the left → **"Add New Service"**.
3. Choose **Gmail** (or whichever email provider you use).
4. Click **Connect Account** and authorise your Gmail. Give the service a name like "BookButterfly".
5. Click **Save**. You'll see a **Service ID** (looks like `service_xxxxxxx`). Copy it.

### Create an Email Template

6. In the left sidebar, click **"Email Templates"** → **"Create New Template"**.
7. Fill it in like this:

   **Subject:**
   ```
   Book Butterfly Report — {{verdict}}
   ```

   **Body (paste this exactly):**
   ```
   Hi Mama!

   Book Butterfly checked a book and here's the result:

   Result: {{verdict}}

   What the book said: {{book_info}}

   Book Butterfly's reason: {{butterfly_reason}}

   Your child's message: {{child_feedback}}

   Love,
   Book Butterfly 🦋
   ```

8. In the **"To email"** field, enter: `{{to_email}}`
9. Click **Save**. You'll see a **Template ID** (looks like `template_xxxxxxx`). Copy it.

### Get Your Public Key

10. In the left sidebar, click **"Account"** → **"General"**.
11. Copy your **Public Key** (also called "User ID", looks like a short string of letters/numbers).

---

## Step 3 — Fill in config.js

Open the file `config.js` (it's in the same folder as `index.html`) in any text editor (Notepad on Windows, TextEdit on Mac).

Replace each placeholder with the real value you copied:

```js
const CONFIG = {
  ANTHROPIC_API_KEY: 'sk-ant-...your real key here...',
  EMAILJS_SERVICE_ID: 'service_xxxxxxx',
  EMAILJS_TEMPLATE_ID: 'template_xxxxxxx',
  EMAILJS_PUBLIC_KEY: 'your_public_key_here',
  PARENT_EMAIL: 'ankita.sayal@gmail.com'
};
```

Save the file.

---

## Step 4 — Open the App

**Option A — Open locally (simplest):**
Double-click `index.html`. It will open in your web browser.

> Note: Camera capture works best from a phone browser when hosted online (Option B).
> On a computer, the "Upload a Picture" button works perfectly.

**Option B — Put it online with Netlify (free, takes 2 minutes, enables phone camera):**

1. Go to **https://app.netlify.com** and sign up (free).
2. On your dashboard, look for the **"Deploy manually"** section or "Sites" → drag and drop.
3. Drag the entire `book-butterfly` folder onto the Netlify drop zone.
4. Netlify gives you a URL like `https://amazing-name-123.netlify.app`. Share this with your child.

---

## EmailJS Template Variable Reference

When setting up the EmailJS template, use these exact variable names (with double curly braces):

| Variable | What it contains |
|---|---|
| `{{to_email}}` | Your email address |
| `{{verdict}}` | GOOD or NOT_YET |
| `{{book_info}}` | The book description text your child entered |
| `{{child_feedback}}` | The message your child wrote to you |
| `{{butterfly_reason}}` | Book Butterfly's one-sentence explanation |

---

## Troubleshooting

- **"Ask Mama to add the magic key" message** → `config.js` still has the placeholder. Make sure you saved the file after editing.
- **No email received** → Check your spam folder. Also verify the EmailJS service is connected and the template uses `{{to_email}}` in the To field.
- **API errors** → Check that your Anthropic account has credit loaded at console.anthropic.com → Billing.
