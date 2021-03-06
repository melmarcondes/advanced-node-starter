const puppeteer = require('puppeteer');
const {TimeoutError} = require('puppeteer/Errors');
const sessionFactory = require('../factories/sessionFactory');
const userFactory = require('../factories/userFactory');

Number.prototype._called = {}

class CustomPage {
  static async build() {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    //await page.setBypassCSP(true);
    const customPage = new CustomPage(page);

    return new Proxy(customPage, {
      get: function(target, property) {
        return customPage[property] || browser[property] || page[property];
      }
    });
  }

  constructor(page) {
    this.page = page;
  }

  async login() {
    const user = await userFactory();
    const { session, sig } = sessionFactory(user);
    
    console.log("user", user);
    console.log("session", session);
    console.log("sig", sig);

    await this.page.setCookie({ name: 'session', value: session });
    await this.page.setCookie({ name: 'session.sig', value: sig });
    await this.page.goto('http://localhost:3000/blogs');
    try {
      await this.page.waitFor('a[href="/auth/logout"]');
    } catch (e) {
      if (e instanceof TimeoutError) {
        console.log(e);
      }
    }
  }

  async getContentsOf(selector) {
    const content = await this.page.$eval(selector, el => el.innerHTML);
    return content;
  }

  get(path) {
    return this.page.evaluate(_path => {
      return fetch(_path, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        }
      }).then(res => res.json());
    }, path);
  }

  post(path, data) {
    return this.page.evaluate(
        (_path, _data) => {
          return fetch(_path, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(_data)
          }).then(res => res.json());
        },
        path,
        data
    );
  }

  execRequests(actions) {
    return Promise.all(
        actions.map(({ method, path, data }) => {
          return this[method](path, data);
        })
    );
  }
}

module.exports = CustomPage;
