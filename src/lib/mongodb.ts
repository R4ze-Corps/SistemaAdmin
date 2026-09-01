import { attachDatabasePool } from "@vercel/functions";
import { Db, MongoClient, ServerApiVersion } from "mongodb";

declare global {
  var _refugioMongoClientPromise: Promise<MongoClient> | undefined;
}

function getUri() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Defina MONGODB_URI no arquivo .env.local antes de conectar o banco.');
  }
  return uri;
}

export function getMongoClient() {
  if (!global._refugioMongoClientPromise) {
    const client = new MongoClient(getUri(), {
      appName: "refugio-gestao",
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });
    attachDatabasePool(client);
    global._refugioMongoClientPromise = client.connect();
  }

  return global._refugioMongoClientPromise;
}

export async function getDatabase(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB || "refugio_gestao");
}