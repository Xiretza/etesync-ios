import * as sjcl from 'sjcl';
import crypto from 'webcrypto';

import * as Constants from './Constants';
import { byte, base64 } from './Helpers';

(sjcl as any).beware['CBC mode is dangerous because it doesn\'t protect message integrity.']();

sjcl.random.startCollectors();

export const HMAC_SIZE_BYTES = 32;

export class AsymmetricKeyPair {
  public publicKey: byte[];
  public privateKey: byte[];

  constructor(publicKey: byte[], privateKey: byte[]) {
    this.publicKey = publicKey;
    this.privateKey = privateKey;
  }
}

export function deriveKey(salt: string, password: string): string {
  const keySize = 190 * 8;

  return sjcl.codec.base64.fromBits((sjcl.misc as any).scrypt(password, salt, 16384, 8, 1, keySize));
}

export function genUid() {
  const rand = sjcl.random.randomWords(4);
  return sjcl.codec.hex.fromBits(hmac256(rand, rand));
}

function hmac256(salt: sjcl.BitArray, key: sjcl.BitArray) {
  const hmac = new sjcl.misc.hmac(salt);
  return hmac.encrypt(key);
}

export class CryptoManager {

  public static fromDerivedKey(key: byte[], version: number = Constants.CURRENT_VERSION) {
    // FIXME: Cleanup this hack
    const ret = new CryptoManager('', '', version);
    ret.key = sjcl.codec.bytes.toBits(key);
    ret._updateDerivedKeys();
    return ret;
  }
  public version: number;
  public key: sjcl.BitArray;
  public cipherKey: sjcl.BitArray;
  public hmacKey: sjcl.BitArray;

  public cipherWords = 4;

  constructor(_keyBase64: base64, salt: string, version: number = Constants.CURRENT_VERSION) {
    this.version = version;
    const key = sjcl.codec.base64.toBits(_keyBase64);
    // FIXME: Clean up all exeptions
    if (version > Constants.CURRENT_VERSION) {
      throw new Error('VersionTooNewException');
    } else if (version === 1) {
      this.key = key;
    } else {
      this.key = hmac256(sjcl.codec.utf8String.toBits(salt), key);
    }

    this._updateDerivedKeys();
  }

  public _updateDerivedKeys() {
    this.cipherKey = hmac256(sjcl.codec.utf8String.toBits('aes'), this.key);
    this.hmacKey = hmac256(sjcl.codec.utf8String.toBits('hmac'), this.key);
  }

  public encryptBits(content: sjcl.BitArray): byte[] {
    const iv = sjcl.random.randomWords(this.cipherWords);

    const prp = new sjcl.cipher.aes(this.cipherKey);
    const cipherText = sjcl.mode.cbc.encrypt(prp, content, iv);
    return sjcl.codec.bytes.fromBits(iv.concat(cipherText));
  }

  public decryptBits(content: byte[]): sjcl.BitArray {
    const cipherText = sjcl.codec.bytes.toBits(content);
    const iv = cipherText.splice(0, this.cipherWords);

    const prp = new sjcl.cipher.aes(this.cipherKey);
    const clearText = sjcl.mode.cbc.decrypt(prp, cipherText, iv);
    return clearText;
  }

  public encryptBytes(content: byte[]): byte[] {
    return this.encryptBits(sjcl.codec.bytes.toBits(content));
  }

  public decryptBytes(content: byte[]): byte[] {
    return sjcl.codec.bytes.fromBits(this.decryptBits(content));
  }

  public encrypt(content: string): byte[] {
    return this.encryptBits(sjcl.codec.utf8String.toBits(content));
  }

  public decrypt(content: byte[]): string {
    return sjcl.codec.utf8String.fromBits(this.decryptBits(content));
  }

  public hmac(content: byte[]): byte[] {
    return sjcl.codec.bytes.fromBits(this.hmacBase(content));
  }

  public hmac64(content: byte[]): base64 {
    return sjcl.codec.base64.fromBits(this.hmacBase(content));
  }

  public hmacHex(content: byte[]): string {
    return sjcl.codec.hex.fromBits(this.hmacBase(content));
  }

  private hmacBase(_content: byte[]): sjcl.BitArray {
    let content;
    if (this.version === 1) {
      content = sjcl.codec.bytes.toBits(_content);
    } else {
      content = sjcl.codec.bytes.toBits(_content.concat([this.version]));
    }

    return hmac256(this.hmacKey, content);
  }
}

function bufferToArray(buffer: Buffer) {
  return Array.prototype.slice.call(buffer);
}

export class AsymmetricCryptoManager {

  public static async generateKeyPair() {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 3071,
        publicExponent: 65537,
        hash: {name: 'SHA-256'},
      },
      false,
      ['encrypt', 'decrypt']
    );
    return new AsymmetricKeyPair(
      bufferToArray(keyPair.publicKey), bufferToArray(keyPair.privateKey));
  }

  constructor(keyPair: AsymmetricKeyPair) {
    // empty on purpose
  }

  public async encryptBytes(publicKey: byte[], content: byte[]): Promise<byte[]> {
    const key = await crypto.subtle.importKey(
      'spki',
      Buffer.from(publicKey),
      {
        name: 'RSA-OAEP',
        hash: {name: 'SHA-256'},
      },
      false,
      ['encrypt']
    );
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'RSA-OAEP',
      },
      key,
      Buffer.from(content)
    );
    return bufferToArray(encrypted);
  }

  public async decryptBytes(privateKey: byte[], content: byte[]): Promise<byte[]> {
    const key = await crypto.subtle.importKey(
      'pkcs8',
      Buffer.from(privateKey),
      {
        name: 'RSA-OAEP',
        hash: {name: 'SHA-256'},
      },
      false,
      ['decrypt']
    );
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'RSA-OAEP',
      },
      key,
      Buffer.from(content)
    );
    return bufferToArray(decrypted);
  }
}
