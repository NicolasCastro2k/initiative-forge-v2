// backend/prisma/seed-race-background-presets.ts
//
// Ejecutar con: npx tsx prisma/seed-race-background-presets.ts
// (o agregar la llamada a este archivo en tu seed.ts principal)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const RACES = [
  { id: "human", name: "Humano", speed: 30, size: "Medium",
    abilityBonuses: { strength: 1, dexterity: 1, constitution: 1, intelligence: 1, wisdom: 1, charisma: 1 },
    traits: ["Versátil", "Idioma extra"], languages: ["Común", "Uno adicional a elección"] },
  { id: "elf-high", name: "Elfo (Alto)", speed: 30, size: "Medium",
    abilityBonuses: { dexterity: 2, intelligence: 1 },
    traits: ["Visión en penumbra", "Ascendencia feérica", "Trance", "Maestría con armas élficas", "Truco de mago"],
    languages: ["Común", "Élfico"] },
  { id: "elf-wood", name: "Elfo (Bosque)", speed: 35, size: "Medium",
    abilityBonuses: { dexterity: 2, wisdom: 1 },
    traits: ["Visión en penumbra", "Ascendencia feérica", "Trance", "Paso del bosque", "Máscara de la naturaleza salvaje"],
    languages: ["Común", "Élfico"] },
  { id: "dwarf-hill", name: "Enano (Colina)", speed: 25, size: "Medium",
    abilityBonuses: { constitution: 2, wisdom: 1 },
    traits: ["Visión en penumbra", "Resiliencia enana", "Resistencia al veneno", "Competencia en herramientas", "Tenacidad enana"],
    languages: ["Común", "Enano"] },
  { id: "dwarf-mountain", name: "Enano (Montaña)", speed: 25, size: "Medium",
    abilityBonuses: { constitution: 2, strength: 2 },
    traits: ["Visión en penumbra", "Resiliencia enana", "Entrenamiento enano con armas", "Entrenamiento con armadura"],
    languages: ["Común", "Enano"] },
  { id: "halfling-lightfoot", name: "Mediano (Pies ligeros)", speed: 25, size: "Small",
    abilityBonuses: { dexterity: 2, charisma: 1 },
    traits: ["Suerte", "Valiente", "Agilidad mediana", "Naturaleza discreta"],
    languages: ["Común", "Mediano"] },
  { id: "halfling-stout", name: "Mediano (Robusto)", speed: 25, size: "Small",
    abilityBonuses: { dexterity: 2, constitution: 1 },
    traits: ["Suerte", "Valiente", "Agilidad mediana", "Resistencia robusta"],
    languages: ["Común", "Mediano"] },
  { id: "dragonborn", name: "Dracónido", speed: 30, size: "Medium",
    abilityBonuses: { strength: 2, charisma: 1 },
    traits: ["Ascendencia dracónica", "Arma de aliento", "Resistencia al daño"],
    languages: ["Común", "Dracónico"] },
  { id: "gnome-forest", name: "Gnomo (Bosque)", speed: 25, size: "Small",
    abilityBonuses: { intelligence: 2, dexterity: 1 },
    traits: ["Visión en penumbra", "Astucia gnómica", "Ilusión natural", "Habla con bestias pequeñas"],
    languages: ["Común", "Gnómico"] },
  { id: "gnome-rock", name: "Gnomo (Roca)", speed: 25, size: "Small",
    abilityBonuses: { intelligence: 2, constitution: 1 },
    traits: ["Visión en penumbra", "Astucia gnómica", "Conocimiento del artesano", "Inventor de trastos"],
    languages: ["Común", "Gnómico"] },
  { id: "half-elf", name: "Semielfo", speed: 30, size: "Medium",
    abilityBonuses: { charisma: 2 },
    traits: ["Visión en penumbra", "Ascendencia feérica", "Versatilidad en habilidades"],
    languages: ["Común", "Élfico", "Uno adicional a elección"] },
  { id: "half-orc", name: "Semiorco", speed: 30, size: "Medium",
    abilityBonuses: { strength: 2, constitution: 1 },
    traits: ["Visión en penumbra", "Amenazador", "Resistencia implacable", "Ataques salvajes"],
    languages: ["Común", "Orco"] },
  { id: "tiefling", name: "Tiefling", speed: 30, size: "Medium",
    abilityBonuses: { intelligence: 1, charisma: 2 },
    traits: ["Visión en penumbra", "Resistencia infernal", "Legado infernal"],
    languages: ["Común", "Infernal"] },
];

const BACKGROUNDS = [
  { id: "acolyte", name: "Acólito",
    skillProficiencies: ["Perspicacia", "Religión"], toolProficiencies: [], languages: 2,
    feature: "Refugio de los fieles",
    featureDescription: "Puedes obtener ayuda de otros seguidores de tu fe: comida, alojamiento humilde, y sanación.",
    equipment: ["Símbolo sagrado", "Libro de oraciones", "5 varillas de incienso", "Vestiduras", "Ropa común", "15 po"] },
  { id: "charlatan", name: "Charlatán",
    skillProficiencies: ["Engaño", "Prestidigitación"], toolProficiencies: ["Kit de disfraz", "Kit de falsificación"], languages: 0,
    feature: "Identidad falsa",
    featureDescription: "Tienes una segunda identidad con documentos, contactos y reputación asociados.",
    equipment: ["Ropa fina", "Kit de disfraz", "Herramientas de estafador", "15 po"] },
  { id: "criminal", name: "Criminal",
    skillProficiencies: ["Engaño", "Sigilo"], toolProficiencies: ["Un juego de herramientas de ladrón", "Un juego de dados/naipes"], languages: 0,
    feature: "Contacto criminal",
    featureDescription: "Tienes un contacto fiable que actúa como enlace con una red criminal.",
    equipment: ["Palanca", "Ropa oscura con capucha", "15 po"] },
  { id: "entertainer", name: "Artista",
    skillProficiencies: ["Acrobacias", "Actuación"], toolProficiencies: ["Un disfraz", "Un instrumento musical"], languages: 0,
    feature: "Habitué",
    featureDescription: "Siempre puedes encontrar un lugar gratis para actuar a cambio de alojamiento y comida modestos.",
    equipment: ["Instrumento musical", "Ropa de admirador", "15 po"] },
  { id: "folk-hero", name: "Héroe del pueblo",
    skillProficiencies: ["Trato con animales", "Supervivencia"], toolProficiencies: ["Herramientas de artesano", "Vehículos terrestres"], languages: 0,
    feature: "Hospitalidad rústica",
    featureDescription: "La gente común te oculta de la ley y te da lo básico que necesites.",
    equipment: ["Herramientas de artesano", "Pala", "Olla de hierro", "Ropa común", "10 po"] },
  { id: "guild-artisan", name: "Artesano de gremio",
    skillProficiencies: ["Perspicacia", "Persuasión"], toolProficiencies: ["Herramientas de artesano"], languages: 1,
    feature: "Membresía de gremio",
    featureDescription: "Como miembro de un gremio, recibes apoyo de tus colegas artesanos.",
    equipment: ["Herramientas de artesano", "Carta de presentación del gremio", "Ropa de viaje", "15 po"] },
  { id: "hermit", name: "Ermitaño",
    skillProficiencies: ["Medicina", "Religión"], toolProficiencies: ["Kit de herbolario"], languages: 1,
    feature: "Descubrimiento",
    featureDescription: "Tu aislamiento te otorgó un gran descubrimiento espiritual o secreto.",
    equipment: ["Kit de herbolario", "Manuscrito de tus revelaciones", "Ropa común", "5 po"] },
  { id: "noble", name: "Noble",
    skillProficiencies: ["Historia", "Persuasión"], toolProficiencies: ["Un juego de dados/naipes"], languages: 1,
    feature: "Posición de privilegio",
    featureDescription: "Tu posición social te abre puertas y consigues audiencias con la nobleza local.",
    equipment: ["Ropa fina", "Anillo de sello", "Pergamino de linaje", "25 po"] },
  { id: "outlander", name: "Forastero",
    skillProficiencies: ["Atletismo", "Supervivencia"], toolProficiencies: ["Un instrumento musical"], languages: 1,
    feature: "Deambulante",
    featureDescription: "Recuerdas la geografía de las tierras salvajes y encuentras comida y agua para tu grupo.",
    equipment: ["Lanza", "Arco corto y flechas", "Trofeo de caza", "Ropa de viaje", "10 po"] },
  { id: "sage", name: "Sabio",
    skillProficiencies: ["Arcanos", "Historia"], toolProficiencies: [], languages: 2,
    feature: "Investigador",
    featureDescription: "Sabes dónde y cómo buscar información y a menudo sabes exactamente a quién preguntar.",
    equipment: ["Botella de tinta", "Pluma", "Cuchillo pequeño", "Carta de un colega fallecido", "Ropa común", "10 po"] },
  { id: "sailor", name: "Marinero",
    skillProficiencies: ["Atletismo", "Percepción"], toolProficiencies: ["Herramientas de navegante", "Vehículos acuáticos"], languages: 0,
    feature: "Pasaje en barco",
    featureDescription: "Puedes conseguir pasaje gratis en barco para ti y tus compañeros.",
    equipment: ["Palanca", "Cuerda de seda", "Amuleto de la suerte", "Ropa común", "10 po"] },
  { id: "soldier", name: "Soldado",
    skillProficiencies: ["Atletismo", "Intimidación"], toolProficiencies: ["Un juego de dados/naipes", "Vehículos terrestres"], languages: 0,
    feature: "Rango militar",
    featureDescription: "Tu rango militar es reconocido entre soldados de tu ejército o afiliación.",
    equipment: ["Insignia de rango", "Trofeo de un enemigo caído", "Ropa común", "10 po"] },
  { id: "urchin", name: "Pilluelo",
    skillProficiencies: ["Sigilo", "Prestidigitación"], toolProficiencies: ["Kit de disfraz", "Herramientas de ladrón"], languages: 0,
    feature: "Conoce la ciudad",
    featureDescription: "Conoces los pasajes secretos de tu ciudad y puedes encontrarlos rápidamente.",
    equipment: ["Cuchillo pequeño", "Mapa de tu ciudad natal", "Ratón amaestrado", "Ropa común", "10 po"] },
];

async function main() {
  console.log("Sembrando razas...");
  for (const race of RACES) {
    await prisma.racePreset.upsert({
      where: { id: race.id },
      update: race,
      create: race,
    });
  }
  console.log(`${RACES.length} razas sembradas.`);

  console.log("Sembrando trasfondos...");
  for (const background of BACKGROUNDS) {
    await prisma.backgroundPreset.upsert({
      where: { id: background.id },
      update: background,
      create: background,
    });
  }
  console.log(`${BACKGROUNDS.length} trasfondos sembrados.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });