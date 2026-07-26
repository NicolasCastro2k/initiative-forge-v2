// backend/prisma/seed-spell-presets.ts
//
// Ejecutar con: npx tsx prisma/seed-spell-presets.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SpellSeed = {
  id: string;
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  rangeFeet?: number;
  components?: string[];
  duration: string;
  concentration?: boolean;
  ritual?: boolean;
  classes?: string[];
  description: string;
  attackType?: "melee_spell" | "ranged_spell";
  savingThrow?: string;
  damageDice?: string;
  damageType?: string;
  healingDice?: string;
  areaShape?: "cone" | "cube" | "sphere" | "line";
  areaSizeFeet?: number;
  higherLevels?: string;
  notes?: string;
};

const SPELLS: SpellSeed[] = [
  // ─── TRUCOS (Nivel 0) ─────────────────────────────────────────────────────
  {
    id: "acid-splash", name: "Acid Splash", level: 0, school: "Conjuración",
    castingTime: "1 acción", range: "60 pies (18 m)", rangeFeet: 60,
    classes: ["Wizard", "Sorcerer"],
    components: ["V", "S"], duration: "Instantánea",
    description: "Creas una pequeña esfera de ácido que puede afectar a una o dos criaturas cercanas entre sí. Cada objetivo debe intentar esquivarla.",
    savingThrow: "dexterity", damageDice: "1d6", damageType: "ácido",
    notes: "Muy útil cuando hay enemigos agrupados.",
  },
  {
    id: "blade-ward", name: "Blade Ward", level: 0, school: "Abjuración",
    castingTime: "1 acción", range: "Personal", components: ["V", "S"], duration: "1 ronda",
    classes: ["Bard", "Sorcerer", "Warlock", "Wizard"],
    description: "Te preparas para recibir ataques físicos, reduciendo el daño de armas cuerpo a cuerpo y a distancia no mágicas durante un breve momento.",
    notes: "Ideal para sobrevivir cuando esperas varios ataques.",
  },
  {
    id: "chill-touch", name: "Chill Touch", level: 0, school: "Nigromancia",
    castingTime: "1 acción", range: "120 pies (36,5 m)", rangeFeet: 120,
    classes: ["Sorcerer", "Warlock", "Wizard"],
    components: ["V", "S"], duration: "1 ronda",
    description: "Una mano espectral golpea al enemigo causando energía necrótica e impidiendo que recupere puntos de vida temporalmente.",
    attackType: "ranged_spell", damageDice: "1d8", damageType: "necrótico",
    notes: "Especialmente efectivo contra criaturas con regeneración.",
  },
  {
    id: "dancing-lights", name: "Dancing Lights", level: 0, school: "Evocación",
    castingTime: "1 acción", range: "120 pies (36,5 m)", rangeFeet: 120,
    classes: ["Bard", "Sorcerer", "Wizard"],
    duration: "Concentración, hasta 1 minuto", concentration: true,
    description: "Creas hasta cuatro luces flotantes que iluminan un área o forman figuras sencillas. Puedes moverlas mientras duren.",
    notes: "Exploración e iluminación.",
  },
  {
    id: "fire-bolt", name: "Fire Bolt", level: 0, school: "Evocación",
    castingTime: "1 acción", range: "120 pies (36,5 m)", rangeFeet: 120,
    classes: ["Sorcerer", "Wizard"],
    duration: "Instantánea",
    description: "Disparas un rayo de fuego concentrado contra un objetivo.",
    attackType: "ranged_spell", damageDice: "1d10", damageType: "fuego",
    notes: "Uno de los mejores ataques básicos del juego.",
  },
  {
    id: "friends", name: "Friends", level: 0, school: "Encantamiento",
    castingTime: "1 acción", range: "Personal",
    classes: ["Bard", "Sorcerer", "Warlock", "Wizard"],
    duration: "Concentración, hasta 1 minuto", concentration: true,
    description: "Obtienes ventaja en pruebas de Carisma contra una criatura durante un minuto. Cuando termina el efecto, el objetivo sabe que fue influenciado mágicamente.",
    notes: "Interacciones sociales.",
  },
  {
    id: "light", name: "Light", level: 0, school: "Evocación",
    castingTime: "1 acción", range: "Toque", duration: "1 hora",
    classes: ["Bard", "Cleric", "Sorcerer", "Wizard"],
    description: "Un objeto tocado emite luz brillante y tenue durante una hora.",
    notes: "Fuente de iluminación permanente durante aventuras.",
  },
  {
    id: "mage-hand", name: "Mage Hand", level: 0, school: "Conjuración",
    castingTime: "1 acción", range: "30 pies (9 m)", rangeFeet: 30, duration: "1 minuto",
    classes: ["Bard", "Sorcerer", "Warlock", "Wizard"],
    description: "Invocas una mano espectral capaz de mover objetos ligeros, abrir puertas, manipular mecanismos y transportar pequeños objetos.",
    notes: "Uno de los hechizos más útiles para exploración.",
  },
  {
    id: "mending", name: "Mending", level: 0, school: "Transmutación",
    castingTime: "1 minuto", range: "Toque", duration: "Instantánea",
    classes: ["Bard", "Cleric", "Druid", "Sorcerer", "Wizard"],
    description: "Repara pequeñas roturas o grietas en objetos no mágicos.",
    notes: "Reparación de equipo.",
  },
  {
    id: "message", name: "Message", level: 0, school: "Transmutación",
    castingTime: "1 acción", range: "120 pies (36,5 m)", rangeFeet: 120, duration: "Instantánea",
    classes: ["Bard", "Sorcerer", "Wizard"],
    description: "Envías un mensaje susurrado a otra criatura, que puede responder inmediatamente.",
    notes: "Comunicación silenciosa.",
  },
  {
    id: "minor-illusion", name: "Minor Illusion", level: 0, school: "Ilusión",
    castingTime: "1 acción", range: "30 pies (9 m)", rangeFeet: 30, duration: "1 minuto",
    classes: ["Bard", "Sorcerer", "Warlock", "Wizard"],
    description: "Creas una imagen o sonido simple para distraer, ocultar o engañar.",
    notes: "Excelente para resolver problemas de forma creativa.",
  },
  {
    id: "poison-spray", name: "Poison Spray", level: 0, school: "Conjuración",
    castingTime: "1 acción", range: "10 pies (3 m)", rangeFeet: 10, duration: "Instantánea",
    classes: ["Druid", "Sorcerer", "Warlock", "Wizard"],
    description: "Expulsas una nube de veneno hacia una criatura cercana.",
    savingThrow: "constitution", damageDice: "1d12", damageType: "veneno",
  },
  {
    id: "prestidigitation", name: "Prestidigitation", level: 0, school: "Transmutación",
    castingTime: "1 acción", range: "10 pies (3 m)", rangeFeet: 10, duration: "Hasta 1 hora según el efecto",
    classes: ["Bard", "Sorcerer", "Warlock", "Wizard"],
    description: "Realizas pequeños efectos mágicos como limpiar, ensuciar, encender velas, crear olores, cambiar colores o producir diminutos trucos.",
    notes: "Interpretación, exploración y creatividad.",
  },
  {
    id: "ray-of-frost", name: "Ray of Frost", level: 0, school: "Evocación",
    castingTime: "1 acción", range: "60 pies (18 m)", rangeFeet: 60, duration: "Instantánea",
    classes: ["Sorcerer", "Wizard"],
    description: "Lanzas un rayo helado que daña y ralentiza al objetivo.",
    attackType: "ranged_spell", damageDice: "1d8", damageType: "frío",
    notes: "Reduce la velocidad del objetivo durante un turno.",
  },
  {
    id: "resistance", name: "Resistance", level: 0, school: "Abjuración",
    castingTime: "1 acción", range: "Toque",
    classes: ["Cleric", "Druid"],
    duration: "Concentración, hasta 1 minuto", concentration: true,
    description: "Otorgas a una criatura una pequeña protección mágica que le permite sumar 1d4 a una tirada de salvación antes de que el efecto termine.",
    notes: "Ideal antes de atravesar trampas o enfrentar efectos mágicos.",
  },

  // ─── NIVEL 1 ────────────────────────────────────────────────────────────────
  {
    id: "alarm", name: "Alarm", level: 1, school: "Abjuración",
    castingTime: "1 minuto", range: "30 pies (9 m)", rangeFeet: 30,
    components: ["V", "S", "M"], duration: "8 horas", ritual: true,
    classes: ["Ranger", "Wizard"],
    description: "Proteges un área determinada. Si una criatura entra en ella, el hechizo activa una alarma audible o mental para el lanzador.",
    notes: "Excelente para vigilar campamentos o habitaciones.", higherLevels: "No escala.",
  },
  {
    id: "burning-hands", name: "Burning Hands", level: 1, school: "Evocación",
    castingTime: "1 acción", range: "Personal (cono de 15 pies / 4,5 m)",
    classes: ["Sorcerer", "Wizard"],
    components: ["V", "S"], duration: "Instantánea",
    description: "Una explosión de llamas sale de tus manos alcanzando todas las criaturas dentro del cono.",
    savingThrow: "dexterity", damageDice: "3d6", damageType: "fuego",
    areaShape: "cone", areaSizeFeet: 15,
    higherLevels: "+1d6 por cada nivel superior.", notes: "Muy efectivo contra grupos.",
  },
  {
    id: "charm-person", name: "Charm Person", level: 1, school: "Encantamiento",
    castingTime: "1 acción", range: "30 pies (9 m)", rangeFeet: 30, duration: "1 hora",
    classes: ["Bard", "Druid", "Sorcerer", "Warlock", "Wizard"],
    description: "Una criatura humanoide pasa a considerarte un conocido amistoso mientras dure el efecto.",
    savingThrow: "wisdom", higherLevels: "Afecta una criatura adicional por nivel superior.",
  },
  {
    id: "color-spray", name: "Color Spray", level: 1, school: "Ilusión",
    castingTime: "1 acción", range: "Personal (cono de 15 pies / 4,5 m)", duration: "Instantánea",
    classes: ["Sorcerer", "Wizard"],
    areaShape: "cone", areaSizeFeet: 15,
    description: "Genera un destello multicolor que puede cegar temporalmente a criaturas cercanas según sus puntos de vida restantes.",
    higherLevels: "Aumenta la cantidad de puntos de vida afectados.",
  },
  {
    id: "command", name: "Command", level: 1, school: "Encantamiento",
    castingTime: "1 acción", range: "60 pies (18 m)", rangeFeet: 60, duration: "1 turno",
    classes: ["Cleric", "Paladin"],
    description: "Pronuncias una palabra de una sola orden (\"Corre\", \"Suelta\", \"Acércate\", etc.). Si falla la salvación, el objetivo debe obedecer durante un turno.",
    savingThrow: "wisdom", higherLevels: "Permite afectar más criaturas.",
  },
  {
    id: "comprehend-languages", name: "Comprehend Languages", level: 1, school: "Adivinación",
    castingTime: "1 acción", range: "Personal", duration: "1 hora", ritual: true,
    classes: ["Bard", "Sorcerer", "Warlock", "Wizard"],
    description: "Comprendes el significado de cualquier idioma hablado o escrito que veas.",
  },
  {
    id: "cure-wounds", name: "Cure Wounds", level: 1, school: "Evocación",
    castingTime: "1 acción", range: "Toque", duration: "Instantánea",
    classes: ["Bard", "Cleric", "Druid", "Paladin", "Ranger"],
    description: "Restauras energía vital a una criatura.",
    healingDice: "1d8", higherLevels: "+1d8 por nivel superior.",
  },
  {
    id: "detect-magic", name: "Detect Magic", level: 1, school: "Adivinación",
    castingTime: "1 acción", range: "Personal (9 m)",
    classes: ["Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Wizard"],
    duration: "Concentración, hasta 10 minutos", concentration: true, ritual: true,
    description: "Percibes la presencia y escuela de magia cercana.",
  },
  {
    id: "detect-poison-and-disease", name: "Detect Poison and Disease", level: 1, school: "Adivinación",
    castingTime: "1 acción", range: "Personal", duration: "Concentración, hasta 10 minutos", concentration: true,
    classes: ["Cleric", "Druid", "Paladin", "Ranger"],
    description: "Detecta venenos, enfermedades y fuentes contaminadas cercanas.",
  },
  {
    id: "disguise-self", name: "Disguise Self", level: 1, school: "Ilusión",
    castingTime: "1 acción", range: "Personal", duration: "1 hora",
    classes: ["Bard", "Sorcerer", "Wizard"],
    description: "Cambias tu apariencia física mediante una ilusión convincente.",
  },
  {
    id: "expeditious-retreat", name: "Expeditious Retreat", level: 1, school: "Transmutación",
    castingTime: "1 acción", range: "Personal", duration: "Concentración, hasta 10 minutos", concentration: true,
    classes: ["Sorcerer", "Warlock", "Wizard"],
    description: "Puedes usar la acción adicional para correr cada turno, aumentando enormemente tu movilidad.",
  },
  {
    id: "false-life", name: "False Life", level: 1, school: "Nigromancia",
    castingTime: "1 acción", range: "Personal", duration: "1 hora",
    classes: ["Sorcerer", "Wizard"],
    description: "Obtienes puntos de golpe temporales.",
    higherLevels: "Más puntos temporales por nivel superior.",
  },
  {
    id: "feather-fall", name: "Feather Fall", level: 1, school: "Transmutación",
    castingTime: "1 reacción", range: "60 pies (18 m)", rangeFeet: 60, duration: "1 minuto",
    classes: ["Sorcerer", "Wizard"],
    description: "Reduce drásticamente la velocidad de caída de hasta cinco criaturas evitando daño por caída.",
  },
  {
    id: "fog-cloud", name: "Fog Cloud", level: 1, school: "Conjuración",
    castingTime: "1 acción", range: "120 pies (36,5 m)", rangeFeet: 120,
    classes: ["Druid", "Ranger", "Sorcerer", "Wizard"],
    duration: "Concentración, hasta 1 hora", concentration: true,
    description: "Creas una nube espesa que bloquea completamente la visión.",
    higherLevels: "Aumenta el radio.",
  },
  {
    id: "grease", name: "Grease", level: 1, school: "Conjuración",
    castingTime: "1 acción", range: "60 pies (18 m)", rangeFeet: 60, duration: "1 minuto",
    classes: ["Wizard"],
    description: "Cubres el suelo con grasa resbaladiza provocando caídas y dificultando el movimiento.",
    savingThrow: "dexterity",
  },
  {
    id: "guiding-bolt", name: "Guiding Bolt", level: 1, school: "Evocación",
    castingTime: "1 acción", range: "120 pies (36,5 m)", rangeFeet: 120, duration: "Instantánea",
    classes: ["Cleric"],
    description: "Un rayo luminoso daña al enemigo y el siguiente ataque contra él tiene ventaja.",
    attackType: "ranged_spell", damageDice: "4d6", damageType: "radiante",
    higherLevels: "+1d6 por nivel superior.",
  },
  {
    id: "healing-word", name: "Healing Word", level: 1, school: "Evocación",
    castingTime: "1 acción adicional", range: "60 pies (18 m)", rangeFeet: 60, duration: "Instantánea",
    classes: ["Bard", "Cleric", "Druid"],
    description: "Restauras vida a distancia con una palabra mágica.",
    healingDice: "1d4", higherLevels: "+1d4 por nivel superior.",
  },
  {
    id: "heroism", name: "Heroism", level: 1, school: "Encantamiento",
    castingTime: "1 acción", range: "Toque", duration: "Concentración, hasta 1 minuto", concentration: true,
    classes: ["Bard", "Paladin"],
    description: "La criatura objetivo se vuelve inmune al miedo y obtiene puntos de golpe temporales cada turno.",
  },
  {
    id: "hideous-laughter", name: "Hideous Laughter", level: 1, school: "Encantamiento",
    castingTime: "1 acción", range: "30 pies (9 m)", rangeFeet: 30,
    classes: ["Bard", "Sorcerer", "Warlock", "Wizard"],
    duration: "Concentración, hasta 1 minuto", concentration: true,
    description: "La víctima cae presa de una risa incontrolable, quedando incapacitada mientras dure el efecto.",
    savingThrow: "wisdom",
  },
  {
    id: "identify", name: "Identify", level: 1, school: "Adivinación",
    castingTime: "1 minuto", range: "Toque", duration: "Instantánea", ritual: true,
    classes: ["Bard", "Wizard"],
    description: "Revela las propiedades mágicas de un objeto, cómo utilizarlo y si requiere vinculación.",
  },
  {
    id: "jump", name: "Jump", level: 1, school: "Transmutación",
    castingTime: "1 acción", range: "Toque", components: ["V", "S", "M"], duration: "1 minuto",
    classes: ["Druid", "Ranger", "Sorcerer", "Wizard"],
    description: "Triplica la distancia de salto de una criatura durante la duración del hechizo.",
    higherLevels: "No escala.", notes: "Ideal para superar obstáculos, fosos o alcanzar lugares elevados.",
  },
  {
    id: "longstrider", name: "Longstrider", level: 1, school: "Transmutación",
    castingTime: "1 acción", range: "Toque", components: ["V", "S", "M"], duration: "1 hora",
    classes: ["Bard", "Druid", "Ranger", "Sorcerer", "Wizard"],
    description: "Aumenta la velocidad de movimiento del objetivo en 10 pies (3 metros).",
    higherLevels: "Puedes afectar una criatura adicional por cada nivel superior.",
  },
  {
    id: "mage-armor", name: "Mage Armor", level: 1, school: "Abjuración",
    castingTime: "1 acción", range: "Toque", duration: "8 horas",
    classes: ["Sorcerer", "Wizard"],
    description: "Protege a una criatura sin armadura mediante energía mágica. La CA base pasa a ser 13 + modificador de Destreza.",
    notes: "Fundamental para magos y hechiceros.",
  },
  {
    id: "magic-missile", name: "Magic Missile", level: 1, school: "Evocación",
    castingTime: "1 acción", range: "120 pies (36,5 m)", rangeFeet: 120, duration: "Instantánea",
    classes: ["Sorcerer", "Wizard"],
    description: "Creas tres proyectiles de energía que impactan automáticamente, sin necesitar tirada de ataque.",
    damageDice: "3d4+3", damageType: "fuerza",
    higherLevels: "+1 misil por nivel superior.", notes: "No requiere tirada de ataque.",
  },
  {
    id: "protection-from-evil-and-good", name: "Protection from Evil and Good", level: 1, school: "Abjuración",
    castingTime: "1 acción", range: "Toque", duration: "Concentración, hasta 10 minutos", concentration: true,
    classes: ["Cleric", "Paladin", "Warlock", "Wizard"],
    description: "Protege al objetivo contra aberraciones, celestiales, elementales, feéricos, infernales y no muertos: desventaja para atacarte y no pueden encantarte ni asustarte fácilmente.",
  },
  {
    id: "purify-food-and-drink", name: "Purify Food and Drink", level: 1, school: "Transmutación",
    castingTime: "1 acción", range: "10 pies (3 m)", rangeFeet: 10, duration: "Instantánea",
    classes: ["Cleric", "Druid", "Paladin", "Ranger"],
    description: "Elimina venenos y enfermedades de comida y bebida.",
    notes: "Supervivencia y exploración.",
  },
  {
    id: "sanctuary", name: "Sanctuary", level: 1, school: "Abjuración",
    castingTime: "1 acción adicional", range: "30 pies (9 m)", rangeFeet: 30, duration: "1 minuto",
    classes: ["Cleric"],
    description: "Los enemigos deben superar una salvación de Sabiduría antes de poder atacar al objetivo protegido. El efecto termina si el objetivo realiza un ataque o lanza un hechizo ofensivo.",
    savingThrow: "wisdom",
  },
  {
    id: "shield", name: "Shield", level: 1, school: "Abjuración",
    castingTime: "1 reacción", range: "Personal", duration: "Hasta el inicio de tu siguiente turno",
    classes: ["Sorcerer", "Wizard"],
    description: "Una barrera mágica aumenta tu Clase de Armadura en +5 y bloquea el hechizo Magic Missile.",
    notes: "Uno de los mejores hechizos defensivos del juego.",
  },
  {
    id: "shield-of-faith", name: "Shield of Faith", level: 1, school: "Abjuración",
    castingTime: "1 acción adicional", range: "60 pies (18 m)", rangeFeet: 60,
    classes: ["Cleric", "Paladin"],
    duration: "Concentración, hasta 10 minutos", concentration: true,
    description: "Un aura brillante concede +2 a la Clase de Armadura.",
  },
  {
    id: "sleep", name: "Sleep", level: 1, school: "Encantamiento",
    castingTime: "1 acción", range: "90 pies (27 m)", rangeFeet: 90, duration: "1 minuto",
    classes: ["Bard", "Sorcerer", "Wizard"],
    description: "Una oleada mágica hace dormir criaturas con pocos puntos de vida.",
    higherLevels: "Afecta más puntos de vida al usar espacios superiores.", notes: "Muy poderoso en niveles bajos.",
  },
  {
    id: "speak-with-animals", name: "Speak with Animals", level: 1, school: "Adivinación",
    castingTime: "1 acción", range: "Personal", duration: "10 minutos", ritual: true,
    classes: ["Bard", "Druid", "Ranger"],
    description: "Permite mantener conversaciones sencillas con animales.",
  },
  {
    id: "tashas-hideous-laughter", name: "Tasha's Hideous Laughter", level: 1, school: "Encantamiento",
    castingTime: "1 acción", range: "30 pies (9 m)", rangeFeet: 30,
    classes: ["Bard", "Sorcerer", "Warlock", "Wizard"],
    duration: "Concentración, hasta 1 minuto", concentration: true,
    description: "La criatura cae al suelo riendo sin control y queda incapacitada mientras dure el efecto.",
    savingThrow: "wisdom",
  },
  {
    id: "tensers-floating-disk", name: "Tenser's Floating Disk", level: 1, school: "Conjuración",
    castingTime: "1 acción", range: "30 pies (9 m)", rangeFeet: 30, duration: "1 hora", ritual: true,
    classes: ["Wizard"],
    description: "Invoca un disco flotante capaz de transportar hasta 500 libras (227 kg).",
    notes: "Mover tesoros, suministros o equipo pesado.",
  },
  {
    id: "thunderwave", name: "Thunderwave", level: 1, school: "Evocación",
    castingTime: "1 acción", range: "Personal (cubo de 15 pies / 4,5 m)", duration: "Instantánea",
    classes: ["Bard", "Sorcerer", "Wizard"],
    areaShape: "cube", areaSizeFeet: 15,
    description: "Una onda explosiva empuja a las criaturas y produce un estruendo audible a gran distancia.",
    savingThrow: "constitution", damageDice: "2d8", damageType: "trueno",
    higherLevels: "+1d8 por nivel superior.",
  },
  {
    id: "unseen-servant", name: "Unseen Servant", level: 1, school: "Conjuración",
    castingTime: "1 acción", range: "Personal", duration: "1 hora", ritual: true,
    classes: ["Bard", "Warlock", "Wizard"],
    description: "Invocas un sirviente invisible que realiza tareas sencillas siguiendo órdenes.",
  },
  {
    id: "witch-bolt", name: "Witch Bolt", level: 1, school: "Evocación",
    castingTime: "1 acción", range: "30 pies (9 m)", rangeFeet: 30, duration: "Instantánea",
    classes: ["Sorcerer", "Warlock", "Wizard"],
    description: "Un rayo eléctrico conecta al lanzador con el objetivo, permitiendo seguir causando daño mientras mantengas la concentración.",
    attackType: "ranged_spell", damageDice: "1d12", damageType: "relámpago",
    higherLevels: "+1d12 por nivel superior al lanzamiento inicial.",
  },
  {
    id: "animal-friendship", name: "Animal Friendship", level: 1, school: "Encantamiento",
    castingTime: "1 acción", range: "30 pies (9 m)", rangeFeet: 30, duration: "24 horas",
    classes: ["Bard", "Druid", "Ranger"],
    description: "Convences mágicamente a una bestia de que no eres una amenaza.",
    savingThrow: "wisdom",
  },
  {
    id: "bless", name: "Bless", level: 1, school: "Encantamiento",
    castingTime: "1 acción", range: "30 pies (9 m)", rangeFeet: 30,
    classes: ["Cleric", "Paladin"],
    duration: "Concentración, hasta 1 minuto", concentration: true,
    description: "Hasta tres criaturas añaden 1d4 a sus tiradas de ataque y salvación.",
    higherLevels: "Una criatura adicional por nivel superior.",
  },
  {
    id: "bane", name: "Bane", level: 1, school: "Encantamiento",
    castingTime: "1 acción", range: "30 pies (9 m)", rangeFeet: 30,
    classes: ["Bard", "Cleric"],
    duration: "Concentración, hasta 1 minuto", concentration: true,
    description: "Hasta tres enemigos restan 1d4 a sus ataques y tiradas de salvación.",
    savingThrow: "charisma",
  },
  {
    id: "create-or-destroy-water", name: "Create or Destroy Water", level: 1, school: "Transmutación",
    castingTime: "1 acción", range: "30 pies (9 m)", rangeFeet: 30, duration: "Instantánea",
    classes: ["Cleric", "Druid"],
    description: "Puedes crear agua potable en recipientes o destruir agua existente en un área.",
    higherLevels: "Aumenta el volumen de agua por nivel superior.",
    notes: "Supervivencia, exploración y campañas en desiertos.",
  },
];

async function main() {
  console.log("Sembrando hechizos...");
  for (const spell of SPELLS) {
    await prisma.spellPreset.upsert({
      where: { id: spell.id },
      update: spell,
      create: spell,
    });
  }
  console.log(`${SPELLS.length} hechizos sembrados.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });