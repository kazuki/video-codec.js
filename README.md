video-codec.js
==============

JavaScriptによるH.264エンコーダ/デコーダのサンプルです．
エンコーダはx264，デコーダはopenH264をemscriptenを使ってコンパイルし，利用しています．


コンパイル方法
--------------

emscriptenを準備し，emconfigureやemcc等のコマンドにPATHを通し，
以下のコマンドを実行します．

    $ ./build-dep-libs
    $ make


サンプルの内容
--------------

**index.html**: ローカルファイルのエンコード・デコードサンプル．y4mファイルやH.264のByte stream format(Annex B)を再生したり，y4mファイルからH.264へエンコードを行います

**camera.html**: WebRTCを使って取得したカメラの映像をWebWorkerでエンコード・デコードしレンダリングするサンプル

renderer.tsに含まれるシェーダによる色空間変換コードは[Broadway]のものを利用しています．

[Broadway]: https://github.com/mbebenita/Broadway "Broadway: A JavaScript H.264 decoder."