const fs = require('node:fs');
const path = require('node:path');

const baileysLib = path.join(__dirname, '..', 'node_modules', '@whiskeysockets', 'baileys', 'lib');
const baileysPackage = require(path.join(__dirname, '..', 'node_modules', '@whiskeysockets', 'baileys', 'package.json'));
const baileysMajor = Number(baileysPackage.version.split('.')[0]);

function replaceOnce(relativePath, marker, original, replacement) {
  const file = path.join(baileysLib, relativePath);
  if (!fs.existsSync(file)) {
    throw new Error(`Baileys file was not found: ${relativePath}`);
  }

  const source = fs.readFileSync(file, 'utf8');
  if (source.includes(marker)) return;
  if (!source.includes(original)) {
    throw new Error(`Baileys patch anchor did not match: ${relativePath}`);
  }

  fs.writeFileSync(file, source.replace(original, replacement));
}

if (baileysMajor < 7) {
replaceOnce(
  path.join('Utils', 'decode-wa-message.js'),
  'PN/LID decrypt retry patch',
  `                                msgBuffer = await repository.decryptMessage({
                                    jid: user,
                                    type: e2eType,
                                    ciphertext: content
                                });`,
  `                                try {
                                    msgBuffer = await repository.decryptMessage({
                                        jid: user,
                                        type: e2eType,
                                        ciphertext: content
                                    });
                                }
                                catch (err) {
                                    // PN/LID decrypt retry patch: WhatsApp may identify the
                                    // same device using its paired phone or LID address.
                                    const altUser = isLidUser(user)
                                        ? stanza.attrs.participant_pn || stanza.attrs.sender_pn
                                        : stanza.attrs.participant_lid || stanza.attrs.sender_lid;
                                    console.info('[bot] Baileys: decrypt fallback available:', Boolean(altUser && altUser !== user));
                                    if (!altUser || altUser === user) {
                                        throw err;
                                    }
                                    logger.debug({ key: fullMessage.key, primary: user, retryWith: altUser }, 'primary identity failed to decrypt, retrying with stanza-provided PN/LID pairing');
                                    try {
                                        msgBuffer = await repository.decryptMessage({
                                            jid: altUser,
                                            type: e2eType,
                                            ciphertext: content
                                        });
                                        console.info('[bot] Baileys: decrypt fallback succeeded.');
                                    }
                                    catch {
                                        // Keep the original error if the alternate identity fails too.
                                        console.info('[bot] Baileys: decrypt fallback failed.');
                                        throw err;
                                    }
                                }`,
);

replaceOnce(
  path.join('Utils', 'decode-wa-message.js'),
  'decrypt identity hints diagnostic patch',
  "console.info('[bot] Baileys: decrypt fallback available:', Boolean(altUser && altUser !== user));",
  `console.info('[bot] Baileys: decrypt identity hints:', {
                                        primary: isLidUser(user) ? 'lid' : user?.endsWith('@s.whatsapp.net') ? 'phone' : 'other',
                                        senderPn: Boolean(stanza.attrs.sender_pn),
                                        senderLid: Boolean(stanza.attrs.sender_lid),
                                        participantPn: Boolean(stanza.attrs.participant_pn),
                                        participantLid: Boolean(stanza.attrs.participant_lid),
                                        alternateDiffers: Boolean(altUser && altUser !== user)
                                    });
                                    console.info('[bot] Baileys: decrypt fallback available:', Boolean(altUser && altUser !== user));`,
);
}

replaceOnce(
  path.join('Socket', 'messages-recv.js'),
  "node.attrs.offline === '1' ? 'append' : 'notify'",
  "await upsertMessage(msg, node.attrs.offline ? 'append' : 'notify');",
  "await upsertMessage(msg, node.attrs.offline === '1' ? 'append' : 'notify');",
);

replaceOnce(
  path.join('Socket', 'messages-recv.js'),
  "const isOffline = node.attrs.offline === '1';",
  'const isOffline = !!node.attrs.offline;',
  "const isOffline = node.attrs.offline === '1';",
);
