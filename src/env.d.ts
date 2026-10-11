declare namespace App {
  interface Locals {
    lang: "es" | "en";
    basePath: string;
    renanimeUser?: {
      id: string;
      name: string;
      aka: string;
      recovery_code?: string;
      created_at?: string;
    };
  }
}
