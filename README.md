
# Running the Application

Follow these steps to setup and run this demo. The steps are described in detail below.

## Prerequisite
- [npm](https://www.npmjs.com/)  (v5.x)
- [Node](https://nodejs.org/en/) (version 8.9 or higher - note version 9 is not supported)
* to install specific Node version you can use [nvm](https://davidwalsh.name/nvm)

  Example:
  + 1. `nvm install 8.9.4`
  + 2. `nvm use v8.9.4`
  + 3. Output `Now using node v8.9.4 (npm v6.1.0)`
- [Hyperledger Composer](https://hyperledger.github.io/composer/installing/development-tools.html)
  * to install composer cli
    `npm install -g composer-cli@0.19.4`
  * to install composer-rest-server
    `npm install -g composer-rest-server@0.19.4`
  * to install generator-hyperledger-composer
    `npm install -g generator-hyperledger-composer@0.19.4`

## Steps
1. [Generate the Business Network Archive](#1-generate-the-business-network-archive)
2. [Deploy Network](#2-deploy-network)
      - [Deploy to Fabric locally](./docs/deploy-local-fabric.md)
3. [Run Application](#3-run-application)


## 1. Generate the Business Network Archive

Next we will generate the Business Network Archive (BNA) file from the root directory.  
This file will contain your network including:
- the model defined in the `net.secure.trust.cto` file in the `models` folder
- the logic behind transactions in the `logic.js` file in the `lib` folder
- permissions defined in the `permissions.acl` file
- queries defined in the `queries.qry` file

Run the following the command to create the bna file:
```
npm install
```

The `composer archive create` command in `package.json` has created a file called `trust-network@0.0.1.bna`.   



## 2. Deploy Network

The bna can be deployed to a local instance of Fabric.

- [Deploy to Hyperledger Fabric locally](./docs/deploy-local-fabric.md)


## 3. Run Application

Go into the `web-app` folder and install the dependency:

```
cd web-app/
npm install
```

Start the application:
```
npm start
```

The application should now be running at:
`http://localhost:8000`


## Links
* [Hyperledger Fabric Docs](http://hyperledger-fabric.readthedocs.io/en/latest/)
* [Hyperledger Composer Docs](https://hyperledger.github.io/composer/latest/introduction/introduction.html)

## License
[Apache 2.0](LICENSE)
