import { Database } from 'bun:sqlite';
import { rm } from 'node:fs/promises';

export default class Madomagi extends Map {
  #db = null;
  #update = null;
  #updater = null;
  #getEtag = null;
  #updateEtag = null;
  #deleter = null;
  #delete = null;

  constructor($) {
    $ = new Database($, { create: true });
    $.query('create table if not exists asset_json(file char(128) primary key, etag char(128));').run();
    $.query('create table if not exists download_asset(path char(128) primary key, md5 char(128));').run();
    $.query('create table if not exists delete_asset(path char(128) primary key);').run();
    super($.query('select path, md5 from download_asset;').values());
    this.#db = $;
    this.#getEtag = $.query('select etag from asset_json where file = $file;');
    this.#updateEtag = $.query('insert or replace into asset_json(file, etag) values($file, $etag)');
    this.#updater = $.prepare('insert or replace into download_asset(path, md5) values($path, $md5);');
    this.#update = $.transaction($ => $.map($ => this.#updater.run($)));
    this.#deleter = $.prepare('delete from download_asset where path = $path;');
    this.#delete = $.transaction($ => $.map($ => this.#deleter.run($)));
  }

  getEtag($file) {
    return this.#getEtag.get({ $file })?.etag;
  }

  updateEtag($file, $etag) {
    return this.#updateEtag.run({ $file, $etag });
  }

  filter({ path, md5 }) {
    return md5 = md5 !== this.get(path = `resource/${path}`), this.delete(path), md5;
  }

  update($) {
    return this.#update($.map(({ path, md5 }) => (
      this.delete(path), { $path: `resource/${path}`, $md5: md5 }
    )));
  }

  async close() {
    this.#getEtag.finalize();
    this.#updateEtag.finalize();
    this.#updater.finalize();
    await Promise.all([...this.keys()].map(async $path => (
      await rm(new URL($path, import.meta.url), { force: true }), { $path }
    ))).then($ => this.#delete($));
    this.#deleter.finalize();
    this.#db.close();
  }
}
