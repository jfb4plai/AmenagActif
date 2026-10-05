# Génère les deux variantes d'entrée de l'essai de pertinence (classes FICTIVES).
# A = trois profils de classe séparés (ce qu'un enseignant obtient aujourd'hui, une classe à la fois).
# B = synthèse multi-classes (prototype de synthesePourClasses + rendu .md de la spec v2).
import json
LIB = {
    'ar_supports_mise_en_page': ('AU', 'supports', 'Mise en page'),
    'ar_supports_reformuler_consignes': ('AU', 'supports', 'Reformuler et clarifier les consignes ; proposer des exemples concrets'),
    'ar_supports_arial_14': ('AR', 'supports', 'Rédiger le cours en Arial 14'),
    'ar_supports_consignes_epurees': ('AR', 'supports', "Rédiger des consignes, sans élément distracteur, comprenant uniquement les éléments essentiels à sa résolution (verbes d'actions)"),
    'ar_supports_consigne_avant_support': ('AR', 'supports', 'Donner la consigne AVANT de distribuer le support'),
    'ar_supports_carte_mentale_oui': ('AR', 'supports', 'Utiliser des cartes mentales'),
    'ar_supports_carte_mentale_non': ('AR', 'supports', 'Ne pas utiliser de carte mentale'),
    'ar_supports_cours_a3': ('AR', 'supports', 'Fournir le cours en A3'),
    'ar_supports_dictionnaire_annote': ('AR', 'supports', 'Utiliser des annotations et vignettes dans le dictionnaire'),
    'ar_lecture_numeroter_lignes': ('AR', 'lecture', 'Numéroter les lignes dans les textes'),
    'ar_lecture_fluo_oui': ('AR', 'lecture', 'Utiliser du fluo pour mettre en évidence les éléments essentiels, les consignes et les mots clés'),
    'ar_lecture_fluo_non': ('AR', 'lecture', 'Ne pas utiliser de fluo'),
    'ar_lecture_lire_voix_haute': ('AR', 'lecture', 'Lire à voix haute'),
    'ar_lecture_voix_haute_jamais': ('AR', 'lecture', 'Ne jamais faire lire l’élève à voix haute'),
    'ar_lecture_preparer_textes_longs': ('AR', 'lecture', 'Préparer les textes longs, à domicile, avant la leçon'),
}
CLASSES = {
    '3LA': {'au': ['ar_supports_mise_en_page', 'ar_supports_reformuler_consignes'],
            'ar': {'ar_supports_arial_14': '1-2', 'ar_supports_consignes_epurees': '3-5', 'ar_supports_consigne_avant_support': '3-5', 'ar_lecture_numeroter_lignes': '3-5', 'ar_lecture_fluo_oui': '1-2', 'ar_supports_carte_mentale_oui': '1-2', 'ar_lecture_lire_voix_haute': '1-2'}},
    '3LB': {'au': ['ar_supports_mise_en_page', 'ar_supports_reformuler_consignes'],
            'ar': {'ar_supports_consignes_epurees': '1-2', 'ar_supports_consigne_avant_support': '3-5', 'ar_lecture_numeroter_lignes': '1-2', 'ar_lecture_fluo_non': '1-2', 'ar_supports_carte_mentale_non': '1-2', 'ar_lecture_voix_haute_jamais': '1-2', 'ar_lecture_preparer_textes_longs': '1-2'}},
    '3LC': {'au': ['ar_supports_mise_en_page', 'ar_supports_reformuler_consignes'],
            'ar': {'ar_supports_arial_14': '3-5', 'ar_supports_consignes_epurees': '3-5', 'ar_supports_consigne_avant_support': '1-2', 'ar_lecture_numeroter_lignes': '3-5', 'ar_supports_carte_mentale_oui': '3-5', 'ar_supports_dictionnaire_annote': '1-2', 'ar_supports_cours_a3': '1-2'}},
}
REGLES = [('ar_supports_carte_mentale_oui', 'ar_supports_carte_mentale_non'),
          ('ar_lecture_lire_voix_haute', 'ar_lecture_voix_haute_jamais'),
          ('ar_lecture_fluo_oui', 'ar_lecture_fluo_non')]
EMIS, EXP = '2026-10-05', '2026-11-04'
RULE = ("- Rédige chaque consigne destinée aux élèves ainsi : une puce par consigne, qui commence par un verbe d'action à l'infinitif "
        "(« Lire », « Surligner », pas « Lis », « Surligne »), avec un seul verbe d'action par puce. "
        "Une consigne qui demande trois actions s'écrit sur trois puces.\n")


def lire(multi):
    t = "## Comment lire ce fichier\n\n"
    t += ("- Ce fichier décrit les aménagements de classes entières. Il ne contient aucune donnée d'élève.\n"
          "- Les effectifs sont des tranches (`1-2`, `3-5`, `6+`), jamais un nombre exact"
          + (", jamais cumulés entre classes.\n" if multi else ".\n")
          + "- Ne cherche pas à identifier ni à deviner d'élève. N'attribue un aménagement à personne en particulier.\n"
          "- Un code désigne un aménagement du catalogue AménagActif. Un code que tu ne sais pas appliquer est signalé « non appliqué », "
          "avec son libellé. Il n'est jamais ignoré en silence.\n"
          + RULE
          + f"- Ce fichier est valable jusqu'au {EXP}. Au-delà, demande un nouvel export.\n\n")
    return t


def item(c, eff=None):
    return f"- {LIB[c][2]} (`{c}`)" + (f", effectif : {eff}" if eff else "")


def classe_md(nom):
    d = CLASSES[nom]
    t = f"# Profil d'aménagements de la classe {nom} (classe fictive)\n\n"
    t += f"```yaml\nschema: plai.profil-classe\nversion: 1\nemis_le: {EMIS}\nexpire_le: {EXP}\nclasse: {nom}\nniveau: 3e secondaire\n```\n\n"
    t += "## Aménagements universels (AU)\n\nPour toute la classe.\n\n" + "\n".join(item(c) for c in d['au']) + "\n\n"
    t += "## Aménagements raisonnables (AR)\n\n" + "\n".join(item(c, e) for c, e in d['ar'].items()) + "\n\n"
    t += "## Liste de contrôle\n\n" + "\n".join(f"- [ ] `{c}` : {LIB[c][2]}" for c in d['au'] + list(d['ar'])) + "\n\n"
    return t


# ---- A
A = "# Profils d'aménagements de mes trois classes (trois exports séparés)\n\n" + lire(False)
A += "Les trois profils ci-dessous sont indépendants : un par classe.\n\n---\n\n" + "\n---\n\n".join(classe_md(n) for n in CLASSES)
A += "\n## Rappel\n\nL'IA propose, l'enseignant décide et personnalise. Aucune décision automatique sur un élève.\n"

# ---- B (prototype de synthesePourClasses)
noms = list(CLASSES)
codes = {}
for n in noms:
    for c in CLASSES[n]['au']:
        codes.setdefault(c, {})[n] = None
    for c, e in CLASSES[n]['ar'].items():
        codes.setdefault(c, {})[n] = e
socle = {c: v for c, v in codes.items() if len(v) == len(noms)}
compl = {c: v for c, v in codes.items() if len(v) < len(noms)}
inter = []
for a, b in REGLES:
    if a in codes and b in codes:
        inter.append((a, b, sorted(codes[a]), sorted(codes[b])))


def ordre(c):
    return (LIB[c][1], c)


B = "# Profil d'aménagements de mes classes : " + ", ".join(noms) + "\n\n"
B += f"```yaml\nschema: plai.profil-classes\nversion: 1\nemis_le: {EMIS}\nexpire_le: {EXP}\nclasses: [{', '.join(noms)}]\nniveaux: [3e secondaire]\n```\n\n"
B += lire(True)
B += "## À appliquer à toutes les classes\n\nAménagements présents dans les " + str(len(noms)) + " classes : à appliquer d'office à un support unique.\n\n"
for ch in ['supports', 'lecture']:
    lst = [c for c in sorted(socle, key=ordre) if LIB[c][1] == ch]
    if lst:
        B += f"### {ch}\n\n"
        for c in lst:
            eff = ", ".join(f"{n} {socle[c][n]}" for n in noms if socle[c][n])
            B += f"- {LIB[c][2]} (`{c}`)" + (f", effectif par classe : {eff}" if eff else "") + "\n"
        B += "\n"
B += "## À prévoir pour certaines classes\n\n"
for c in sorted(compl, key=ordre):
    cl = ", ".join(f"{n} ({compl[c][n]})" if compl[c][n] else n for n in noms if n in compl[c])
    B += f"- {LIB[c][2]} (`{c}`) : {cl}\n"
B += "\n## Incompatibilités\n\n"
for a, b, ca, cb in inter:
    B += f"- Entre classes : un seul support ne peut pas satisfaire `{a}` ({', '.join(ca)}) et `{b}` ({', '.join(cb)}). Prévoir deux variantes.\n"
B += "\n## Liste de contrôle\n\nAppliquer à toutes les classes :\n\n" + "\n".join(f"- [ ] `{c}` : {LIB[c][2]}" for c in sorted(socle, key=ordre)) + "\n\nAppliquer à certaines classes seulement :\n\n"
B += "\n".join(f"- [ ] `{c}` : {LIB[c][2]} ({', '.join(n for n in noms if n in compl[c])} uniquement)" for c in sorted(compl, key=ordre)) + "\n\n"
B += "## Rappel\n\nL'IA propose, l'enseignant décide et personnalise. Aucune décision automatique sur un élève.\n"

open('entrees/A-trois-profils-separes.md', 'w', encoding='utf-8').write(A)
open('entrees/B-synthese-multi-classes.md', 'w', encoding='utf-8').write(B)
json.dump({'socle': sorted(socle), 'complements': {c: sorted(v) for c, v in compl.items()},
           'inter': [[a, b, ca, cb] for a, b, ca, cb in inter]},
          open('verite-terrain.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(socle), 'socle', len(compl), 'compl', len(inter), 'inter')
