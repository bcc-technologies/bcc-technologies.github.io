# Paste this in your cmd:

~~~
cd admin-local
npm i
npm run dev
~~~

This will run a localhost with an UI to create content for the website, it could be a blog post, service addition or a product addition.
All will be saved in a local database and a gitpush will be made to make it be online in the repo. Make sure that you have nothing else to save before.

All core files are in admin-local and the content created is in the content folder.

# Web CMS with Supabase

The official website uses the same CMS UI at `/cms.html`. The UI detects its runtime:

- Local mode: uses the local Express API and writes to `content/`, `blog/`, and git.
- Web mode: uses Supabase `public.cms_posts`.

Before using it in production, run this SQL in the Supabase SQL Editor:

~~~
resources/SUPABASE_CMS.sql
~~~

The web CMS stores blog posts in `public.cms_posts`. Published posts are readable by the public blog, while drafts and editing are restricted by RLS to admins and staff with CMS roles (`author`, `cofounder`, or `department_director`).

The public blog now loads entries from both places:

- Supabase `cms_posts` for web-created posts.
- `content/content-index.json` as a fallback and for existing static posts.

The local CMS can still be used for workflows that need generated static HTML or repository publishing.

To generate indexable URLs for Supabase posts, run:

~~~
node scripts/generate-supabase-blog.mjs
~~~

That creates static pages at `/blog/{id}.html` and `/en/blog/{id}.html` for published rows in `cms_posts`. The GitHub Actions workflow `Generate Supabase blog pages` can also run this automatically and commit the generated HTML files.

# Working with non-technical staff

I'm planning to make an agent program that you can get as an .exe file or otherwise and gives you limited access to our repository for you to use the UI and modify the database, the program may help them handle the pushes and everything else via a non-technical interface and without giving them real access to the repo.
