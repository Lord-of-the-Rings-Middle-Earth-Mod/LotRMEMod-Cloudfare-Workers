/**
 * Liest die Daten aus dem KV-Speicher.
 * @param {ExecutionContext} env - Das Environment-Objekt, das den Zugriff auf KV ermöglicht.
 * @param {string} namespace - Der Namespace-Name, der im Worker konfiguriert wurde.
 * @param {string} key - Der Schlüssel, den du lesen möchtest.
 * @returns {Promise<any>} - Gibt den Wert aus dem KV-Speicher zurück oder null, wenn nichts gefunden wurde.
 */
export const readFromKV = async (env, namespace, key) => {
  const data = await env[namespace].get(key);
  return data ? JSON.parse(data) : null; // Gibt null zurück, wenn der Schlüssel nicht existiert
};

/**
 * Speichert Daten im KV-Speicher.
 * @param {ExecutionContext} env - Das Environment-Objekt, das den Zugriff auf KV ermöglicht.
 * @param {string} namespace - Der Namespace-Name, der im Worker konfiguriert wurde.
 * @param {string} key - Der Schlüssel, unter dem die Daten gespeichert werden sollen.
 * @param {any} value - Der Wert, der gespeichert werden soll.
 * @returns {Promise<void>} - Eine leere Promise, wenn das Speichern erfolgreich war.
 */
export const saveToKV = async (env, namespace, key, value) => {
  await env[namespace].put(key, JSON.stringify(value));
};
