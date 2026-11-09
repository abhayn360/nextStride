declare global {
  namespace Express {
    interface Request {
      /** Set by the `authenticate` middleware. */
      auth?: { userId: string };
    }
  }
}

export {};
