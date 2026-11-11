/** Provedor de IA pelo nome do modelo: "gemini-..." usa o Gemini; o resto, o Claude. */
function provedorDoModelo(modelo) {
  return String(modelo || "").startsWith("gemini-") ? "gemini" : "claude";
}

if (typeof module !== "undefined") module.exports = { provedorDoModelo };
