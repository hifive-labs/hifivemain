(function() {
	var controller = {
		__name: 'app.controller.GrandChildController',
		my1Logic: h5.res.require('app.logic.GrandLogic'),
		__construct:function(){
			$('body').append('<p>' + this.__name + 'の初期化処理を開始します(__construct実行)</p>');
		},
		__ready:function(){
			$(this.rootElement).append('<p>' + this.__name + 'のバインドが完了しました(__ready実行)</p>');
		}
	};
	h5.core.expose(controller);
})();