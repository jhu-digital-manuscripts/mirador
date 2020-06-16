### Prerequisites

Mirador uses [node.js](http://nodejs.org/) and a build system to assemble, test, and manage the development resources. If you have never used these tools before, you may need to install them.

* NodeJS (https://nodejs.org/en/)
* NPM (https://www.npmjs.com/): will be included when you install NodeJS
* Bower (https://bower.io/): for legacy reasons this project has two different package managers. You can install this using NPM: `npm i <-g> bower`. You can use the `-g` flag to install Bower globally for convenience.

1. Install Node, if you haven't already (available at the link above)  
2. Install the Grunt command line runner (if you haven't already); on the command line, run `npm install -g grunt-cli`  
3. Clone the mirador repository (if you haven't already done so above)
4. On the command line, go into the mirador folder
5. Install all dependencies with `npm install` and `bower install`

### Run in Development

Run the following command to start a development server on your local machine. This will also enable livereload mirador will reload to reflect code changes you make.

```
npm start
```

-------------------------

## Deployments

This fork has extensive customization on top of the Mirador 2 base viewer to support several digital humanities viewers, most notably the AOR and DLMM viewers. Both viewers use the same build artifacts from this repository, but different host landing pages that have different viewer configuration. In short, when either viewer is deployed, they copy the same build artifacts, but copy different versions of `index.html`.

* [Archaeology of Reading viewer](https://archaeologyofreading.org/viewer/#aor) - uses `aor-index.html`
* [Digital Library of Medieval Manuscripts viewer](http://dlmm.library.jhu.edu/viewer/) - uses `dlmm-index.html`

#### Get the project

Clone our github repository, if not done already.

```
git clone https://github.com/jhu-digital-manuscripts/mirador.git
cd mirador/
```

#### Dependencies

In the `mirador/` directory, make sure you are on the `master` branch. Run the following to install dependencies:

```
npm install
bower install
```

#### Building the project

The previous step already installed Grunt to the project, so we will use that, instead of having to install the tool globally.

```
./node_modules/grunt/bin/grunt package
```

This will build and package the Mirador viewer. You can find a ZIP artifact in the `build/` directory. Copy this over to the server (rosetest, or msel-wp most likely) and unzip it in the `build/` folder in the deployment directory. You should already have an `index.html` landing page with mirador configuration already at these locations.

* rosetest
  * Unzip mirador.zip at `/usr/share/tomcat/webapps/dlmm_test/build/`
  * Config should be at `/usr/share/tomcat/webapps/dlmm_test/index.html`
* msel-wp
  * Unzip mirador.zip at `/opt/dlmm/viewer/build/`
  * Config should be at `/opt/dlmm/viewer/index.html`


