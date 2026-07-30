# Getting Started with Umbruch AI

Umbruch AI is a React Router application. Clone the repository and install
dependencies using the current LTS version of Node.js:

```sh
git clone https://github.com/osmancakir/umbruchai.git
cd umbruchai
npm install
```

Copy `.env.example` to `.env` and fill in the values, then run the setup script
to generate the Prisma client and migrate the database.

Check the project README.md for instructions on getting the app deployed. You'll
want to get this done early in the process to make sure you're all set up
properly.

## Development

- Initial setup:

  ```sh
  npm run setup
  ```

- Seed database:

  ```sh
  npx prisma@6 db seed
  ```

- Start dev server:

  ```sh
  npm run dev
  ```

This starts your app in development mode, rebuilding assets on file changes.

The database seed script creates a new user with some data you can use to get
started:

- Username: `kody`
- Password: `kodylovesyou`
