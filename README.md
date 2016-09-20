## Tagifier

### Tagifier is a simple software designed to help you in editing metadata

### [ > Download the latest release](https://github.com/Cyriaqu3/tagifier/releases/latest)

![Audio player from 1.1.0](http://i.imgur.com/fFx2RPI.jpg)

Please note that this app is **very young** and a lot of improvements / additional features will come soon like :

- Tags suggestion
- More tags supported
- Advanced music player
- Localisation (more language supported)
- Mac / Linux support

**Any suggestion / Bug ?**
[Please, report them here](https://github.com/Cyriaqu3/tagifier/issues)

## Develoment

### Prerequisites

- [Node / NPM](https://nodejs.org/)
- [Bower](https://bower.io/)

### Compiling the sources

Clone the repo , open a terminal on the project folder and type :

```
npm install
```

### Working with the sources

Open a terminal on the project folder and type :

```
gulp
```
Stay with the terminal open the src folder will be compiled on fly.

For testing , you have to follow the instructions below.

### Testing the app

Open a terminal on the project folder and type :

```
electron dist/app.js
```

Tagifier should start

### Packaging the App

Open a terminal on the project folder and type :

```
gulp build
```
The packaged software should be available in the folder */build* and the release package (with the setup) in */release*.
