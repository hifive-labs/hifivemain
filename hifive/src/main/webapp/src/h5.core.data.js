/*
 * Copyright (C) 2012 NS Solutions Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * hifive
 */

/* ------ h5.core.data ------ */
(function() {
	// =========================================================================
	//
	// Constants
	//
	// =========================================================================

	//=============================
	// Production
	//=============================

	/** マネージャ名が不正 */
	var ERR_CODE_INVALID_MANAGER_NAME = 15000;

	/** DataItemのsetterに渡された値の型がDescriptorで指定されたものと異なる */
	var ERR_CODE_INVALID_TYPE = 15001;

	/** dependが設定されたプロパティのセッターを呼び出した */
	var ERR_CODE_DEPEND_PROPERTY = 15002;

	/** イベントのターゲットが指定されていない */
	var ERR_CODE_NO_EVENT_TARGET = 15003;

	/** スキーマが不正 */
	var ERR_CODE_INVALID_SCHEMA = 15004;

	/** createDataModelManagerのnamespaceが不正 */
	var ERR_CODE_INVALID_MANAGER_NAMESPACE = 15005;

	/** データモデル名が不正 */
	var ERR_CODE_INVALID_DATAMODEL_NAME = 15006;

	/** createItemでIDが必要なのに指定されていない */
	var ERR_CODE_NO_ID = 15007;

	/** マネージャの登録先に指定されたnamespaceにはすでにその名前のプロパティが存在する */
	var ERR_CODE_REGISTER_TARGET_ALREADY_EXIST = 15008;

	/** 内部エラー：更新ログタイプ不正（通常起こらないはず） */
	var ERR_CODE_INVALID_UPDATE_LOG_TYPE = 15009;

	/** IDは文字列でなければならない */
	var ERR_CODE_ID_MUST_BE_STRING = 15010;

	var ERR_CODE_INVALID_DESCRIPTOR = 15011;

	var ERROR_MESSAGES = [];
	ERROR_MESSAGES[ERR_CODE_INVALID_MANAGER_NAME] = 'マネージャ名が不正';
	ERROR_MESSAGES[ERR_CODE_INVALID_TYPE] = 'DataItemのsetterに渡された値の型がDescriptorで指定されたものと異なる';
	ERROR_MESSAGES[ERR_CODE_DEPEND_PROPERTY] = 'dependが設定されたプロパティのセッターを呼び出した';
	ERROR_MESSAGES[ERR_CODE_NO_EVENT_TARGET] = 'イベントのターゲットが指定されていない';
	ERROR_MESSAGES[ERR_CODE_INVALID_SCHEMA] = 'スキーマが不正';
	ERROR_MESSAGES[ERR_CODE_INVALID_MANAGER_NAMESPACE] = 'createDataModelManagerのnamespaceが不正';
	ERROR_MESSAGES[ERR_CODE_INVALID_DATAMODEL_NAME] = 'データモデル名が不正';
	ERROR_MESSAGES[ERR_CODE_NO_ID] = 'createItemでIDが必要なのに指定されていない';
	ERROR_MESSAGES[ERR_CODE_REGISTER_TARGET_ALREADY_EXIST] = 'マネージャの登録先に指定されたnamespaceにはすでにその名前のプロパティが存在する';
	ERROR_MESSAGES[ERR_CODE_INVALID_UPDATE_LOG_TYPE] = '内部エラー：更新ログタイプ不正';
	ERROR_MESSAGES[ERR_CODE_ID_MUST_BE_STRING] = 'IDは文字列でなければならない';
	ERROR_MESSAGES[ERR_CODE_INVALID_DESCRIPTOR] = 'データモデルディスクリプタにエラーがあります。';
	//	ERROR_MESSAGES[] = '';
	addFwErrorCodeMap(ERROR_MESSAGES);


	var ITEM_PROP_BACKING_STORE_PREFIX = '__';

	var EVENT_ITEMS_CHANGE = 'itemsChange';


	var PROP_CONSTRAINT_REQUIRED = 'required';


	var UPDATE_LOG_TYPE_CREATE = 1;
	var UPDATE_LOG_TYPE_CHANGE = 2;
	var UPDATE_LOG_TYPE_REMOVE = 3;


	//JSDTが使われていないと誤検出するが、使っているので削除してはいけない
	var DEFAULT_TYPE_VALUE = {
		'number': 0,
		'integer': 0,
		'boolean': false
	};


	//=============================
	// Development Only
	//=============================

	var fwLogger = h5.log.createLogger('h5.core.data');

	/* del begin */

	var MSG_ERROR_DUP_REGISTER = '同じ名前のデータモデルを登録しようとしました。同名のデータモデルの2度目以降の登録は無視されます。マネージャ名は {0}, 登録しようとしたデータモデル名は {1} です。';

	/* del end */


	// =========================================================================
	//
	// Cache
	//
	// =========================================================================
	// =========================================================================
	//
	// Privates
	//
	// =========================================================================
	//=============================
	// Variables
	//=============================
	//=============================
	// Functions
	//=============================
	function createDataModelItemsChangeEvent(created, recreated, removed, changed) {
		return {
			type: EVENT_ITEMS_CHANGE,
			created: created,
			recreated: recreated,
			removed: removed,
			changed: changed
		};
	}


	//------------------------------
	// Descriptorバリデーション関係
	//------------------------------

	/**
	 * 引数がNaNかどうか判定する isNaNとは違い、例えば文字列はNaNじゃないのでfalse
	 *
	 * @param {any} v
	 * @return {boolena} 引数がNaNかどうか
	 */
	function isStrictNaN(v) {
		return typeof v === 'number' && isNaN(v);
	}



	/**
	 * type:'number' 指定のプロパティに代入できるかのチェック null,undefined,NaN,parseFloatしてNaNにならないもの
	 * に当てはまる引数についてtrueを返す
	 *
	 * @param {Any} val 判定する値
	 * @param {integer} dementnion 判定する型の配列次元(配列でないなら0)
	 * @return {Boolean} type:'number'指定のプロパティに代入可能か
	 */
	function isNumberValue(val) {
		// nullまたはundefinedはtrue
		// NaNを直接入れた場合はtrue
		// typeがnumberでなくても、parseFloatしてNaNにならないなら代入可能
		return val == null || isStrictNaN(val) || !isStrictNaN(parseFloat(val));
	}

	/**
	 * type:'integer' 指定のプロパティに代入できるかのチェック null,undefined,parseFloatとparsFloatの結果が同じもの(NaNは除く)
	 * に当てはまる引数についてtrueを返す
	 *
	 * @param {Any} val 判定する値
	 * @param {integer} dementnion 判定する型の配列次元(配列でないなら0)
	 * @return {Boolean} type:'integer'指定のプロパティに代入可能か
	 */
	function isIntegerValue(val) {
		// parseIntとparseFloatの結果が同じかどうかで整数値かどうかの判定をする
		// NaN, Infinity, -Infinityはfalseを返す
		// ※ parseIntしてNaNならfalse(NaN === NaN にはならないため。)
		// ※ parseIntは、引数Infinityまたは-Infinityに対して、NaNを返す。(parseFloatはInfinityが返る)
		return val == null || parseInt(val) === parseFloat(val);
	}

	/**
	 * type:'string' 指定のプロパティに代入できるかのチェック
	 *
	 * @param {Any} val 判定する値
	 * @return {Boolean} type:'string'指定のプロパティに代入可能か
	 */
	function isStringValue(val) {
		return val == null || isString(val);
	}

	/**
	 * type:'boolean' 指定のプロパティに代入できるかのチェック
	 *
	 * @param {Any} val 判定する値
	 * @return {Boolean} type:'boolean'指定のプロパティに代入可能か
	 */
	function isBooleanValue(val) {
		return val == null || val === true || val === false;
	}

	/**
	 * type:'array' 指定のプロパティに代入できるかのチェック
	 *
	 * @param {Any} val 判定する値
	 * @return {Boolean} type:'array'指定のプロパティに代入可能か
	 */
	function isArrayValue(val) {
		return val == null || $.isArray(val);
	}

	/**
	 * type:'enum' 指定のプロパティに代入できるかのチェック
	 *
	 * @param {Any} val 判定する値
	 * @param {Array} enumValue 列挙されている値の配列
	 * @return {Boolean} type:'enum'指定のプロパティに代入可能か
	 */
	function isEnumValue(v, enumValue) {
		if (isStrictNaN(v)) {
			// NaN の時は、NaN===NaNにならない(inArrayでも判定できない)ので、enumValueの中身を見て判定する
			for ( var i = 0, l = opt.enumValue.length; i < l; i++) {
				if (isStrictNaN(opt.enumValue[i])) {
					return true;
				}
			}
			return false;
		}
		return $.inArray(v, enumValue) > 0;
	}

	/**
	 * チェック関数と、配列の次元を持つオブジェクトを引数にとり、値のチェックを行う関数を作成して返す
	 *
	 * @param {object} checkObj
	 * @param {array} [checkObj.checkFuncs] チェックする関数の配列。配列の先頭の関数から順番にチェックする。指定のない場合は、return
	 *            true;するだけの関数を作成して返す
	 * @param {integer} [checkObj.dimention]
	 *            チェックする値の配列の次元。配列のdimention次元目が全てcheckFuncsを満たすことと、dimention-1次元目まではすべて配列であることを確認する関数を作成して返す。
	 *            0、または指定無しの場合は配列でないことを表す
	 */
	function createCheckValueByCheckObj(checkObj) {
		var funcs = checkObj.checkFuncs;
		if (!funcs || funcs.length === 0) {
			return function() {
				return true;
			};
		}
		var dim = checkObj.dimention || 0;
		return function checkValue(v) {
			function _checkValue(v, d) {
				if (!d) {
					// チェック関数を順番に適応して、falseが返ってきたらチェック終了してfalseを返す
					for ( var i = 0, l = funcs.length; i < l; i++) {
						if (!funcs[i](v)) {
							return false;
						}
					}
					// 全てのチェック関数についてtrueが返ってきた場合はtrueを返す
					return true;
				}
				// 指定された配列次元と、渡された値の配列の次元があっていない場合はfalseを返す
				if (!$.isArray(v)) {
					return false;
				}
				for ( var i = 0, l = v.length; i < l; i++) {
					// 配列の各要素について、次元を一つ減らして再帰的にチェックする
					if (!_checkValue(v[i], d - 1)) {
						return false;
					}
				}
				// 全ての要素についてチェックが通ればtrue
				return true;
			}
			return _checkValue(v, dim);
		}
	}

	/**
	 * スキーマのプロパティオブジェクトから、そのプロパティに入る値かどうかをチェックする関数を作る。 # schema:{val:xxxx,val2:....}
	 * のxxxxの部分と、マネージャを引数にとる スキーマのチェックが通ってから呼ばれる前提なので、エラーチェックは行わない。
	 *
	 * @param {object} propObj スキーマのプロパティオブジェクト
	 * @param {object} [manager] そのスキーマを持つモデルが属するマネージャのインスタンス。データモデルのチェックに必要(要らないなら省略可能)
	 * @return {function} 指定されたスキーマのプロパティに、引数の値が入るかどうかをチェックする関数
	 */
	function createCheckValueBySchemaPropertyObj(propObj, manager) {
		var checkFuncArray = [];
		var elmType = null;
		var dimention = 0;
		// TODO id:true の場合
		if (propObj.type) {
			var type = propObj.type;
			// "string", "number[][]", "@DataModel"... などを正規表現でチェック
			// TODO この正規表現による取得を、matched相当のオブジェクトを作成する関数として外だしする
			var matched = type
					.match(/^(string|number|integer|boolean|object|array|any|enum|@(.+?))(\[\])*$/);

			elmType = matched[1];
			// 配列の次元。配列でないなら0
			dimention = matched[3] ? matched[3].length / 2 : 0;

			// type指定を元に値を(配列は考慮せずに)チェックする関数を作成してcheckFuncArrayに追加
			checkFuncArray.push(createTypeCheckFunction(elmType, {
				manager: manager,
				enumValue: propObj.enumValue
			}));
		}
		// constraintを値が満たすかどうかチェックする関数を作成してcheckFuncArrayに追加
		if (propObj.constraint) {
			checkFuncArray.push(createConstraintCheckFunction(propObj.constraint));
		}
		return createCheckValueByCheckObj({
			checkFuncs: checkFuncArray,
			dimention: dimention
		});

	}

	/**
	 * データモデルのディスクリプタとして正しいオブジェクトかどうかチェックする。 schema以外をチェックして、正しくないなら例外を投げる。
	 * 正しい場合はvalidateSchemaの戻り値を返す
	 *
	 * @private
	 * @param {Object} descriptor オブジェクト
	 * @param {Object} DataManagerオブジェクト
	 * @return {Object} schemaのチェック結果。validateSchemaの戻り値をそのまま返す
	 */
	function validateDescriptor(descriptor, manager) {
		// TODO validateDescriptorとvalidateSchemaで、エラー投げるのかerrorReason返すのか統一する
		// descriptorがオブジェクトかどうか
		if (!$.isPlainObject(descriptor)) {
			throwFwError(ERR_CODE_INVALID_DESCRIPTOR);
		}

		// nameのチェック
		// TODO 識別子として有効でない文字列ならエラーにするでいいか？
		if (!isValidNamespaceIdentifier(descriptor.name)) {
			throw new Error('データモデル名が不正です。使用できる文字は、半角英数字、_、$、のみで、先頭は数字以外である必要があります。');
		}

		// baseのチェック
		var base = descriptor.base;
		var baseSchema;
		if (base != null) {
			// nullまたはundefinedならチェックしない
			if (!isString(base) || base.indexOf('@') !== 0) {
				// @で始まる文字列（base.indexOf('@')が0でない）ならエラー
				throw new Error('baseの指定が不正です。指定する場合は、継承したいデータモデル名の先頭に"@"を付けた文字列を指定してください。');
			}
			var baseName = base.substring(1);
			var baseModel = manager.models[baseName];
			if (!baseModel) {
				throw new Error('baseに指定されたデータモデルは存在しません。' + baseName);
			}
			baseSchema = manager.models[baseName].schema;
		}

		// schemaのチェック
		// baseSchemaがないのに、schemaが指定されていなかったらエラー
		// schemaが指定されていて、オブジェクトでないならエラー
		var schema = descriptor.schema;
		if (!baseSchema && schema == null || !$.isPlainObject(schema)) {
			throwFwError(ERR_CODE_INVALID_SCHEMA);
		}

		// base指定されていた場合は、後勝ちでextendする
		schema = $.extend(baseSchema, schema);

		// ここでエラー投げるべき？
		return validateSchema(schema, manager);
	}


	/**
	 * schemaが正しいかどうか判定する
	 *
	 * @private
	 * @param {object} schema schemaオブジェクト
	 * @param {object} manager DataManagerオブジェクト
	 * @return {array} エラー理由を格納した配列。エラーのない場合は空配列を返す。
	 */
	function validateSchema(schema, manager) {

		// new DataModelのなかで validate → createCheckFunc → defaultValueの順でチェックする。ここではdefaultValueのチェックはしない。
		// TODO エラーメッセージを定数化する

		// schemaがオブジェクトかどうか
		// TODO 必ずvalidateDescriptorから呼ばれるなら要らない？
		if (!$.isPlainObject(schema)) {
			throwFwError(ERR_CODE_INVALID_SCHEMA);
		}

		// TODO エラーはチェック不整合があったらすぐ投げた方がいい？
		var errorReason = [];
		try {

			// id指定されている属性が一つだけであることをチェック
			var hasId = false;
			for ( var p in schema) {
				if (schema[p].id === true) {
					if (hasId) {
						errorReason.push('idが複数存在');
					}
					hasId = true;
				}
			}
			if (!hasId) {
				errorReason.push('idがない');
			}

			for ( var schemaProp in schema) {
				var propObj = schema[schemaProp];
				var isId = propObj.id;
				// 代入やdefaultValueの値をチェックする関数を格納する配列([typeCheck, constraintCheck]のように格納する)
				var checkFuncArray = [];

				// プロパティ名が適切なものかどうかチェック
				if (!isValidNamespaceIdentifier(schemaProp)) {
					errorReason.push('"' + schemaProp
							+ '"をプロパティ名に指定できません。半角英数字,_,$ で構成される文字列で、先頭は数字以外である必要があります');
				}

				// -- dependのチェック --
				// defaultValueが指定されていたらエラー
				// onに指定されているプロパティがschema内に存在すること
				var depend = propObj.depend;
				if (depend != null) {
					// id指定されているならエラー
					if (isId) {
						errorReason.push('id指定されたプロパティにdependを指定することはできません');
					}

					// dependが指定されているなら、on,calcが指定されていること
					if (depend.on == null) {
						errorReason.push('depend.onには文字列、または文字列の配列ででプロパティ名を指定する必要があります');
					} else {
						var onArray = wrapInArray(depend.on);
						for ( var i = 0, l = onArray.length; i < l; i++) {
							if (!schema[onArray[i]]) {
								errorReason.push('depend.onに指定されたプロパティがデータモデルにありません。');
								break;
							}
						}
					}
					if (typeof depend.calc !== 'function') {
						errorReason.push('depend.calcには関数を指定する必要があります');
					}
				}

				// -- typeのチェック --
				// typeに指定されている文字列は正しいか
				// defaultValueとの矛盾はないか
				// constraintにそのtypeで使えない指定がないか
				// enumの時は、enumValueが指定されているか
				var elmType = null;
				if (propObj.type != null) {
					// id指定されているならエラー
					//					if (isId) {
					//						errorReason.push('id指定されたプロパティにtypeを指定することはできません');
					//					}
					var type = propObj.type;
					if (!isString(type)) {
						errorReason.push('typeは文字列で指定する必要があります');
					}
					// "string", "number[][]", "@DataModel"... などを正規表現でチェック
					// TODO 文字列からtypeObjを作成するような関数を作って外だしする
					var matched = type
							.match(/^(string|number|integer|boolean|object|array|any|enum|@(.+?))(\[\])*$/);
					if (!matched) {
						errorReason.push('typeに指定された文字が不正です。');
					} else {
						// マッチ結果から、データモデル指定の場合と配列の場合をチェックする
						// "string[][][]"のとき、matched = ["string[][][]", "string", undefined, "[][][]", "[]"]
						// "@DataModel"のとき、matched = ["@DataModel", "@DataModel", "DataModel", "", undefined]

						// データモデルの場合
						if (matched[2]) {
							if (!managerl.models[matched[2]]) {
								errorReason.push('タイプに指定されたデータモデルはありません');
							}
						}

						// enumの場合
						if (matched[1] === 'enum') {
							// enumValueが無ければエラー
							if (propObj.enumValue == null) {
								errorReason.push('タイプにenumを指定する場合はenumValueも指定する必要があります');
							}
						}

						// 配列の次元。配列でないなら0
						dimention = matched[3] ? matched[3].length / 2 : 0;

						// タイプから配列指定部分を除いたもの
						elmType = matched[1];

						// type指定を元に値を(配列は考慮せずに)チェックする関数を作成してcheckFuncArrayに追加
						checkFuncArray.push(createTypeCheckFunction(elmType, {
							manager: manager,
							enumValue: propObj.enumValue
						}));
					}
				}

				// constraintのチェック
				// プロパティのチェック
				// 値のチェック
				// タイプと矛盾していないかのチェック
				var constraintObj = propObj.constraint;
				if (constraintObj != null) {
					if (!$.isPlainObject(constraintObj)) {
						errorReason.push('constraintはオブジェクトで指定してください');
					} else {
						for ( var p in constraintObj) {
							// constraintのプロパティの値とtype指定との整合チェック
							var val = constraintObj[p];
							switch (p) {
							case 'notNull':
								if (val != null) {
									if (val !== true || val !== false) {
										errorReason
												.push('constraint.notNullは、trueまたはfalseで指定してください');
									}
								}
								break;
							case 'min':
							case 'max':
								if (val != null) {
									switch (elmType) {
									case 'integer':
										if (!isIntegerValue(val) || isStrictNaN(val)) {
											errorReason
													.push('constraint.minとmax は、数値で指定してください。typeにintegerを指定している場合は整数値で指定する必要があります');
										}
										break;
									case 'number':
										if (!isNumberValue(val) || val === Infinity
												|| val === -Infinity || isStrictNaN(val)) {
											errorReason.push('constraint.minとmax は、数値で指定してください');
										}
										break;
									default:
										errorReason
												.push('constraintにminとmaxを指定できるのはtypeに"number"または"integer"またはその配列を指定した時のみです');
									}
								}
								break;
							case 'minLength':
							case 'maxLength':
								if (val != null) {
									switch (elmType) {
									case 'string':
										if (!isIntegerValue(val) || isStrictNaN(val) || val <= 0) {
											errorReason
													.push('constraint.minLengthとmaxLength は、0以上の整数値で指定してください');
										}
										break;
									default:
										errorReason
												.push('constraintにminLengthとmaxLengthを指定できるのはtypeに"string"またはその配列を指定した時のみです');
									}
								}
								break;
							case 'notEmpty':
								if (val != null) {
									switch (elmType) {
									case 'string':
										if (!isBoolean(val)) {
											errorReason
													.push('constraint.notEmpty は、trueまたはfalseで指定してください');
										}
										break;
									default:
										errorReason
												.push('constraintにnotEmptyを指定できるのはtypeに"string"またはその配列を指定した時のみです');
									}
								}
								break;
							case 'pattern':
								if (val != null) {
									switch (elmType) {
									case 'string':
										if ($.type(val) !== 'regexp') {
											errorReason.push('constraint.notEmpty は、正規表現で指定してください');
										}
										break;
									default:
										errorReason
												.push('constraintにpatternを指定できるのはtypeに"string"またはその配列を指定した時のみです');
									}
								}
								break;
							}
						}

						// constraintの中身に矛盾がないかどうかチェック
						if (constraintObj.notEmpty && constraintObj.minLength === 0) {
							errorReason
									.push('constraintのチェックでエラーが発生しました。notEmptyを指定している場合は\minLengthに0を指定することはできません');
						}
						if (constraintObj.notEmpty && constraintObj.minLength === 0) {
							errorReason
									.push('constraintのチェックでエラーが発生しました。notEmptyを指定している場合は\minLengthに0を指定することはできません');
						}
						if (constraintObj.min != null && constraintObj.max != null
								&& constraintObj.min > constraintObj.max) {
							errorReason
									.push('constraintのチェックでエラーが発生しました。min > max となるような数字は設定できません');
						}
						if (constraintObj.minLength != null && constraintObj.maxLength != null
								&& constraintObj.minLength > constraintObj.maxLength) {
							errorReason
									.push('constraintのチェックでエラーが発生しました。minLength > maxLength となるような数字は設定できません');
						}
					}
				}


				// enumValueのチェック
				var enumValue = propObj.enumValue;
				if (enumValue != null) {
					// elmTypeがenumか
					if (elmType !== 'elem') {
						errorReason.push('enumValueはtypeに"enum"またはその配列が指定されている場合のみ指定可能です');
					}
					// 空でない配列かどうか
					if (!$.isArray(enumValue) || enumValue.length === 0) {
						errorReason.push('enumValueは空でない配列を指定してください。');
					}
					if (propObj.constraint != null) {
						// constraintのチェック
						errorReason.push('enumValue');
					}

				}
			}
		} finally {
			return errorReason;
		}
	}

	/**
	 * constraintオブジェクトから、値がそのconstraintの条件を満たすかどうか判定する関数を作成する
	 *
	 * @param {object} constraint constraintオブジェクト
	 * @return {function}
	 */
	function createConstraintCheckFunction(constraint) {
		return function(v) {
			if (constraint.notNull && v == null) {
				return false;
			}
			if (v == null) {
				// nullでないものについてチェックを行うので、nullならtrueを返す
				return true;
			}
			if (constraint.notEmpty && !v) {
				return false;
			}
			if (constraint.min != null && v < constraint.min) {
				return false;
			}
			if (constraint.max != null && constraint.max < v) {
				return false;
			}
			if (constraint.minLength != null && v.length < constraint.minLength) {
				return false;
			}
			if (constraint.maxLength != null && constraint.maxLength < v.length) {
				return false;
			}
			if (constraint.pattern != null && !v.match(constraint.pattern)) {
				return false;
			}
			return true;
		}
	}

	/**
	 * type指定された文字列(から"[]"を除いた文字列)、引数がそのtypeを満たすかどうか判定する関数を作成する
	 *
	 * @param {string} elmType type指定文字列
	 * @param {object} [opt] type判定に使用するためのオプション
	 * @param {object} [opt.manager]
	 *            DataManagerオブジェクト。"@DataModel"のようにデータモデルを指定された場合、managerからデータモデルを探す
	 * @param {array} [opt.enumValue] typeが"enum"の場合、enumValueに入っているかどうかで判定する
	 * @return {function} 引数がそのtypeを満たすかどうか判定する関数。
	 */
	function createTypeCheckFunction(elmType, opt) {
		switch (elmType) {
		case 'number':
			return isNumberValue;
		case 'integer':
			return isIntegerValue;
		case 'string':
			return isStringValue;
		case 'boolean':
			return isBooleanValue;
		case 'array':
			return isArrayValue;
		case 'enum':
			return isEnumValue;
		}
		// タイプチェックは終わっているはずなので、どのケースにも引っかからない場合はデータモデルかつ、そのデータモデルはマネージャに存在する
		var matched = type.match(/@(.+?)/);
		var dataModelName = matched[1];
		return function(v) {
			var dataModel = manager.models[dataModelName];
			if (!dataModel) {
				// チェック時点でモデルがマネージャからドロップされている場合はfalse
				return false;
			}
			if (v != null || typeof v !== 'object') {
				// オブジェクトでないならfalse
				return false;
			}
			// チェック時にそのモデルが持ってるアイテムかどうかで判定する
			// nullはOK
			return v == null || dataModel.has(v);
		}
	}



	function getValue(item, prop) {
		return item[ITEM_PROP_BACKING_STORE_PREFIX + prop];
	}

	function setValue(item, prop, value) {
		item[ITEM_PROP_BACKING_STORE_PREFIX + prop] = value;
	}

	/**
	 * propで指定されたプロパティのプロパティソースを作成します。
	 *
	 * @private
	 */
	function createDataItemConstructor(model, descriptor) {
		//model.schemaは継承関係を展開した後のスキーマ
		var schema = model.schema;

		function recalculateDependProperties(item, dependProp) {
			return schema[dependProp].depend.calc.call(item);
		}

		//TODO 仮想プロパティに依存する仮想プロパティ、などのネストを考慮する

		//{ 依存元: [依存先] }という構造のマップ。依存先プロパティは配列内で重複はしない。
		var dependencyMap = {};

		for ( var prop in schema) {
			var dependency = schema[prop] ? schema[prop].depend : null;
			if (dependency) {
				var dependOn = wrapInArray(dependency.on);
				for ( var i = 0, len = dependOn.length; i < len; i++) {
					var dependSrcPropName = dependOn[i];

					fwLogger.debug('{0} depends on {1}', prop, dependSrcPropName);

					if (!dependencyMap[dependSrcPropName]) {
						dependencyMap[dependSrcPropName] = [];
					}
					if ($.inArray(prop, dependencyMap[dependSrcPropName]) === -1) {
						dependencyMap[dependSrcPropName].push(prop);
					}
				}
			}
		}

		function createSrc(name, propDesc) {
			//			var propType = propDesc.type;

			//nullが可能な型かどうか
			//TODO combination-typeの場合は「許容されるすべての型がnot nullable」で判定する必要がある
			//			var isNullable = false;
			//			if (propType.charAt(0) === '@' || $.inArray(propType, NULLABLE_PROP_TYPES)) {
			//				isNullable = true;
			//			}
			//
			//			var isRequired = propDesc.constraint
			//					&& ($.inArray(PROP_CONSTRAINT_REQUIRED, propDesc.constraint) !== -1);
			//
			//			var enumValues = propDesc.enumValues;

			function createSetter() {
				/**
				 * スキーマのプロパティタイプをパースします。
				 */
				function parseType(type) {
					var ret = [];

					var splittedType = type.split(',');
					for ( var i = 0, len = splittedType.length; i < len; i++) {
						var typeDef = {
							isArray: false,
							dim: 0,
							checkInner: []
						};

						var t = $.trim(splittedType[i]);
						var arrayIndicatorPos = t.indexOf('[');

						if (arrayIndicatorPos !== -1) {
							typeDef.isArray = true;
							if (t.charAt(0) === '(') {
								//配列内に複数の型が混在できる場合
							} else {
								//'string[]'のように、配列内の型は1つである場合
								var innerType = $.trim(t.slice(1, arrayIndicatorPos));
								if (innerType.charAt(0) === '@') {
									typeDef.checkInner.push();
								} else if (typeCheckFunc[innerType]) {
									typeDef.checkInner.push(typeCheckFunc[innerType]);
								}
							}
						}

						ret.push(typeDef);
					}


					return ret;
				} /* End of parseType() */

				if (propDesc.depend) {
					//依存プロパティの場合は、setterは動作しない（無理に呼ぶとエラー）
					return function() {
						throwFwError(ERR_CODE_DEPEND_PROPERTY);
					};
				}

				return function(value) {
					//					if (isNullable && !isRequired && (value === null)) {
					//プロパティの値が必須でない場合、nullが代入されようとしたら
					//						setValue(this, name, value);
					//						return;
					//					}

					//					if (propType === PROP_TYPE_ENUM) {
					//						//enumの場合は列挙値でチェック
					//						if ($.inArray(value, enumValues) === -1) {
					//							throwFwError(ERR_CODE_INVALID_TYPE);
					//						}
					//					} else {
					//						//それ以外の場合は各関数でチェック
					//						if (!isValidType(value)) {
					//							throwFwError(ERR_CODE_INVALID_TYPE);
					//						}
					//					}

					var oldValue = getValue(this, name);

					if (oldValue === value) {
						//同じ値がセットされた場合は何もしない
						return;
					}

					setValue(this, name, value);

					//TODO もしmanager.isInUpdateだったら、もしくはコンストラクタ内でフラグが立っていたらrecalcを遅延させる、ようにする。
					//コンストラクタ時なら、クロージャ内に変更オブジェクトを突っ込む。
					//manager.isInUpdateなら、manager.__changeLogに入れる

					var changedProps = {};
					changedProps[name] = {
						oldValue: oldValue,
						newValue: value
					};

					var depends = dependencyMap[name];
					if (depends) {
						//このプロパティに依存しているプロパティがある場合は
						//再計算を行う
						for ( var i = 0, len = depends.length; i < len; i++) {
							var dependProp = depends[i];
							var dependOldValue = getValue(this, dependProp);
							var dependNewValue = recalculateDependProperties(this, dependProp);
							setValue(this, dependProp, dependNewValue);
							changedProps[dependProp] = {
								oldValue: dependOldValue,
								newValue: dependNewValue
							};
						}
					}

					//今回変更されたプロパティと依存プロパティを含めてイベント送出
					var event = {
						type: 'change',
						props: changedProps
					};
					this.dispatchEvent(event);
				};
			}

			return {
				get: function() {
					return getValue(this, name);
				},
				set: createSetter()
			};
		}

		//DataItemのコンストラクタ
		function DataItem() {
			//デフォルト値を代入する
			for ( var plainProp in schema) {
				var propDesc = schema[plainProp];
				if (!propDesc) {
					//propDescがない場合はtype:anyとみなす
					this[plainProp] = null;
					continue;
				}

				if (propDesc.depend) {
					continue;
				}

				var defaultValue = propDesc.defaultValue;
				if (defaultValue !== undefined) {
					this[plainProp] = defaultValue;
				} else {
					if (propDesc.type && DEFAULT_TYPE_VALUE[propDesc.type] !== undefined) {
						this[plainProp] = DEFAULT_TYPE_VALUE[propDesc.type];
					} else {
						this[plainProp] = null;
					}
				}
			}

			//TODO dependな項目の計算を、最後に行うようにできないか
		}
		DataItem.prototype = new EventDispatcher();
		$.extend(DataItem.prototype, {
			refresh: function() {
			//TODO refreshされたら、整合性チェックとchangeLog追加を行う
			}
		});

		//TODO DataItemの項目としてrefresh等同名のプロパティが出てきたらどうするか。
		//今のうちに_とかでよけておくか、
		//それともschema側を自動的によけるようにするか、
		//またはぶつからないだろうと考えてよけないか
		//(今は良いかもしれないが、将来的には少し怖い)


		//TODO 外部に移動
		var defaultPropDesc = {
			type: 'any',
			enhance: true
		};

		var propertiesDesc = {};

		//データアイテムのプロトタイプを作成
		//schemaは継承関係展開後のスキーマになっている
		for ( var prop in schema) {
			var propDesc = schema[prop];
			if (!propDesc) {
				propDesc = defaultPropDesc;
			}

			//fwLogger.debug('{0}のプロパティ{1}を作成', model.name, prop);

			if (propDesc.enhance !== undefined && propDesc.enhance === false) {
				continue; //非enhanceなプロパティは、Item生成時にプロパティだけ生成して終わり
			}

			var src = createSrc(prop, propDesc);
			src.enumerable = true;
			src.configurable = false;

			propertiesDesc[prop] = src;
		}

		//TODO settingsか、Managerのフラグで制御する
		Object.defineProperties(DataItem.prototype, propertiesDesc);


		return {
			itemConstructor: DataItem,
			propDesc: propertiesDesc
		};
	}


	/**
	 * 指定されたIDのデータアイテムを生成します。
	 *
	 * @param {DataModel} model データモデル
	 * @param {Object} 初期値
	 * @param {Function} itemChangeListener modelに対応する、データアイテムチェンジイベントリスナー
	 * @returns {DataItem} データアイテムオブジェクト
	 */
	function createItem(model, data, itemChangeListener) {
		//キーが文字列かつ空でない、かどうかのチェックはDataModel.create()で行われている

		var idKey = model.idKey;
		var id = data[idKey];

		//TODO id自動生成の場合は生成する


		var item = new model.itemConstructor();

		//インスタンスごとにaccessor生成、Chromeだとやや遅いので注意（IEの3倍以上）
		//TODO オプションが設定されたらdefinePropする
		//Object.defineProperties(data, model.itemPropDesc);

		item[idKey] = id;

		model.items[id] = item;
		model.size++;

		//初期値として渡されたデータを詰める
		for ( var prop in data) {
			if ((prop == idKey) || !(prop in model.schema)) {
				continue;
			}
			item[prop] = data[prop];
		}

		item.addEventListener('change', itemChangeListener);

		return item;
	}



	/**
	 * スキーマの継承関係を展開し、フラットなスキーマを生成します。 同じ名前のプロパティは「後勝ち」です。
	 *
	 * @param {Object} schema スキーマオブジェクト(このオブジェクトに展開後のスキーマが格納される)
	 * @param {Object} manager データモデルマネージャ
	 * @param {Object} desc データモデルディスクリプタ
	 */
	function extendSchema(schema, manager, desc) {
		var base = desc.base;

		if (base) {
			if (!manager) {
				//baseが設定されている場合、このデータモデルがマネージャに属していなければ継承元を探せないのでエラー
				throwFwError(ERR_CODE_NO_MANAGER);
			}

			//TODO データモデルの登録の順序関係に注意
			var baseModelDesc = manager.models[base.slice(1)];

			//$.extend()は後勝ちなので、より上位のものから順にextend()するように再帰
			extendSchema(schema, manager, baseModelDesc);
		}

		$.extend(schema, desc.schema);
	}

	// =========================================================================
	//
	// Body
	//
	// =========================================================================


	function createSequence(start, step) {
		var current = start !== undefined ? start : 0;
		var theStep = step !== undefined ? step : 1;

		function Sequence() {}
		$.extend(Sequence.prototype, {
			setCurrent: function(value) {
				current = value;
			},
			current: function() {
				return current.toString();
			},
			next: function() {
				var val = current;
				current += theStep;
				return val.toString();
			}
		});

		return new Sequence();
	}

	function createManager(managerName, namespace) {

		/* ----------------- DataModelManagerコード ここから ----------------- */

		/**
		 * @class
		 * @name DataModelManager
		 */
		function DataModelManager(managerName) {
			if (!isValidNamespaceIdentifier(managerName)) {
				throwFwError(ERR_CODE_INVALID_MANAGER_NAME);
			}

			this.models = {};
			this.name = managerName;
			this._updateLogs = null;
		}
		DataModelManager.prototype = new EventDispatcher();
		$.extend(DataModelManager.prototype, {
			/**
			 * @param {Object} descriptor データモデルディスクリプタ
			 * @memberOf DataModelManager
			 */
			createModel: function(descriptor) {
				var modelName = descriptor.name;
				if (!isValidNamespaceIdentifier(modelName)) {
					throwFwError(ERR_CODE_INVALID_DATAMODEL_NAME); //TODO 正しい例外を出す
				}

				if (this.models[modelName]) {
					fwLogger.info(MSG_ERROR_DUP_REGISTER, this.name, modelName);
				} else {
					this.models[modelName] = createDataModel(descriptor, this); //TODO validateSchema
				}

				return this.models[modelName];
			},

			/**
			 * 指定されたデータモデルを削除します。 データアイテムを保持している場合、アイテムをこのデータモデルからすべて削除した後 データモデル自体をマネージャから削除します。
			 *
			 * @param {String} name データモデル名
			 * @memberOf DataModelManager
			 */
			dropModel: function(name) {
				//TODO dropModelするときに依存していたらどうするか？
				//エラーにしてしまうか。
				var model = this.models[name];
				if (!model) {
					return;
				}
				model.manager = null;
				delete this.models[name];
				return model;
			},


			/**
			 * @returns {Boolean} アップデートセッション中かどうか
			 */
			isInUpdate: function() {
				return this._updateLogs !== null;
			},

			beginUpdate: function() {
				if (this.isInUpdate()) {
					return;
				}

				this._updateLogs = {};
			},

			endUpdate: function() {
				if (!this.isInUpdate()) {
					return;
				}

				function getFirstCRLog(itemLogs, lastPos) {
					for ( var i = 0; i < lastPos; i++) {
						var type = itemLogs[i].type;
						if ((type === UPDATE_LOG_TYPE_CREATE || type === UPDATE_LOG_TYPE_REMOVE)) {
							return itemLogs[i];
						}
					}
					return null;
				}

				function hasCreateLog(itemLogs, lastPos) {

				}

				function createDataModelChanges(modelUpdateLogs) {
					var recreated = {};
					var created = [];
					var changed = [];
					var removed = [];

					for ( var itemId in modelUpdateLogs) {
						var itemLogs = modelUpdateLogs[itemId];
						var isChangeOnly = true;

						var changeEventStack = [];

						//新しい変更が後ろに入っているので、降順で履歴をチェックする
						for ( var i = itemLogs.length - 1; i >= 0; i--) {
							var log = itemLogs[i];
							var logType = log.type;

							if (logType === UPDATE_LOG_TYPE_CHANGE) {
								changeEventStack.push(log.ev);
							} else {
								var firstCRLog = getFirstCRLog(itemLogs, i);

								if (logType === UPDATE_LOG_TYPE_CREATE) {
									//begin->remove->create->end のような操作が行われた場合、
									//begin-endの前後でアイテムのインスタンスが変わってしまう。
									//これをイベントで判別可能にするため、remove->createだった場合はcreatedではなくrecreatedに入れる。
									//なお、begin->remove->create->remove->create->endのような場合、
									//途中のcreate->removeは（begin-endの外から見ると）無視してよいので、
									//oldItemには「最初のremoveのときのインスタンス」、newItemには「最後のcreateのときのインスタンス」が入る。
									//また、begin->create->remove->create->endの場合は、begin-endの外から見ると"create"扱いにすればよい。

									if (firstCRLog && firstCRLog.type === UPDATE_LOG_TYPE_REMOVE) {
										recreated[itemId] = {
											oldItem: firstCRLog.item,
											newItem: log.item
										};
									} else {
										created.push(log.item);
									}
								} else {
									//ここに来たら必ずUPDATE_LOG_TYPE_REMOVE

									//begin->create-> ( remove->create-> ) remove -> end つまり
									//beginより前にアイテムがなく、セッション中に作られたが最終的には
									//またremoveされた場合、begin-endの外から見ると「何もなかった」と扱えばよい。

									if (firstCRLog && firstCRLog.type === UPDATE_LOG_TYPE_REMOVE) {
										//begin->remove->create->remove->endの場合、begin-endの外から見ると
										//「最初のremoveで取り除かれた」という扱いにすればよい。
										removed.push(firstCRLog.item);
									} else if (!firstCRLog) {
										//createまたはremoveのログが最後のremoveより前にない
										//＝beginより前からアイテムが存在し、始めてremoveされた
										//＝通常のremoveとして扱う
										removed.push(log.item);
									}
								}

								isChangeOnly = false;

								//CREATEまたはREMOVEを見つけたら、そこで走査を終了
								break;
							}
						}

						//新規追加or削除の場合はcreated, removedに当該オブジェクトが入ればよい。
						//あるアイテムのcreate,removeどちらのログもなかったということは
						//そのオブジェクトはbeginの時点から存在しendのタイミングまで残っていた、ということになる。
						//従って、あとはchangeのイベントオブジェクトをマージすればよい。
						if (isChangeOnly && changeEventStack.length > 0) {
							var mergedProps = {};
							for ( var i = 0, len = changeEventStack.length; i < len; i++) {
								$.extend(mergedProps, changeEventStack[i].props);
							}

							//TODO dependの再計算もここで行う

							var mergedChange = {
								type: 'change',
								target: changeEventStack[0].target,
								props: mergedProps
							};

							changed.push(mergedChange);
						}
					}



					//				var alreadyCalculated = [];
					//
					//				//再計算したプロパティをchangedPropsに追加していくので、ループは__internals.changeで回す必要がある
					//				for ( var srcProp in this.__internals.change) {
					//					var depends = dependencyMap[srcProp];
					//					if (depends) {
					//						for ( var i = 0, len = depends.length; i < len; i++) {
					//							var dependProp = depends[i];
					//							//同じ依存プロパティの再計算は一度だけ行う
					//							if ($.inArray(dependProp, alreadyCalculated) === -1) {
					//								var dependOldValue = getValue(this, dependProp);
					//								var dependNewValue = recalculateDependProperties(this, dependProp);
					//								setValue(this, dependProp, dependNewValue);
					//								//TODO 同じ処理が何か所かで出てくるのでまとめる
					//								changedProps[dependProp] = {
					//									oldValue: dependOldValue,
					//									newValue: dependNewValue
					//								};
					//								alreadyCalculated.push(dependProp);
					//							}
					//						}
					//					}
					//				}



					return {
						created: created,
						recreated: recreated,
						removed: removed,
						changed: changed
					};
				}

				var modelChanges = {};

				var updateLogs = this._updateLogs;
				for ( var modelName in updateLogs) {
					if (!updateLogs.hasOwnProperty(modelName)) {
						continue;
					}

					modelChanges[modelName] = createDataModelChanges(updateLogs[modelName]);
				}

				//全てのモデルの変更が完了してから各モデルの変更イベントを出すため、
				//同じループをもう一度行う
				for ( var modelName in updateLogs) {
					var mc = modelChanges[modelName];
					this.models[modelName].dispatchEvent(createDataModelItemsChangeEvent(
							mc.created, mc.recreated, mc.removed, mc.changed));
				}

				this._updateLogs = null;

				var event = {
					type: EVENT_ITEMS_CHANGE,
					models: modelChanges
				};

				//最後に、マネージャから全ての変更イベントをあげる
				this.dispatchEvent(event);
			}
		});

		/* ----------------- DataModelManagerコード ここまで ----------------- */



		/* ----------------- DataModelコード ここから ----------------- */

		function createDataModel(descriptor, manager) {
			if (!$.isPlainObject(descriptor)) {
				throw new Error('descriptorにはオブジェクトを指定してください。');
			}

			var errorReason = validateDescriptor(descriptor, manager);
			if (errorReason.length > 0) {
				throwFwError(ERR_CODE_INVALID_DESCRIPTOR, null, errorReason);
			}

			/* --- DataModelローカル ここから --- */

			/* --- DataModelローカル ここまで --- */

			/**
			 * @memberOf h5.core.data
			 * @class
			 * @name DataModel
			 */
			function DataModel(descriptor, manager) {
				/**
				 * @memberOf DataModel
				 */
				this.descriptor = null;

				/**
				 * @memberOf DataModel
				 */
				this.items = {};

				/**
				 * @memberOf DataModel
				 */
				this.size = 0;

				/**
				 * @memberOf DataModel
				 */
				this.name = descriptor.name;

				/**
				 * @memberOf DataModel
				 */
				this.manager = manager;

				//TODO
				this.idSequence = 0;

				//継承元がある場合はそのプロパティディスクリプタを先にコピーする。
				//継承元と同名のプロパティを自分で定義している場合は
				//自分が持っている定義を優先するため。
				var schema = {};


				//継承を考慮してスキーマを作成
				extendSchema(schema, manager, descriptor);

				for ( var prop in schema) {
					if (schema[prop] && schema[prop].id === true) {
						//ディスクリプタは事前検証済みなので、IDフィールドは必ず存在する
						this.idKey = prop;
						break;
					}
				}

				//DataModelのschemaプロパティには、継承関係を展開した後のスキーマを格納する
				this.schema = schema;

				var itemSrc = createDataItemConstructor(this, descriptor);

				this.itemConstructor = itemSrc.itemConstructor;
				this.itemPropDesc = itemSrc.propDesc;

				//TODO nameにスペース・ピリオドが入っている場合はthrowFwError()
				//TODO this.fullname -> managerの名前までを含めた完全修飾名
			}

			DataModel.prototype = new EventDispatcher();
			$.extend(DataModel.prototype, {
				/**
				 * 指定されたIDと初期値がセットされたデータアイテムを生成します。<br>
				 * データアイテムはこのデータモデルに紐づけられた状態になっています。<br>
				 * <br>
				 * 指定されたIDのデータアイテムがすでにこのデータモデルに存在した場合は、<br>
				 * 既に存在するデータアイテムを返します（新しいインスタンスは生成されません）。<br>
				 * 従って、1つのデータモデルは、1IDにつき必ず1つのインスタンスだけを保持します。<br>
				 * なお、ここでIDの他に初期値も渡された場合は、既存のインスタンスに初期値をセットしてから返します。<br>
				 * このとき、当該インスタンスにイベントハンドラが設定されていれば、changeイベントが（通常の値更新と同様に）発生します。
				 *
				 * @memberOf DataModel
				 * @param {Object|Object[]} objOrArray 初期値オブジェクト、またはその配列
				 * @returns {DataItem|DataItem[]} データアイテム、またはその配列
				 */
				create: function(objOrArray) {
					var ret = [];

					var idKey = this.idKey;

					//removeで同時に複数のアイテムが指定された場合、イベントは一度だけ送出する。
					//そのため、事前にアップデートセッションに入っている場合はそのセッションを引き継ぎ、
					//入っていない場合は一時的にセッションを作成する。
					var isAlreadyInUpdate = manager ? manager.isInUpdate() : false;

					if (!isAlreadyInUpdate) {
						this.manager.beginUpdate();
					}

					var actualNewItems = [];

					var items = wrapInArray(objOrArray);
					for ( var i = 0, len = items.length; i < len; i++) {
						var valueObj = items[i];

						var itemId = valueObj[idKey];
						if (!isString(itemId) || itemId.length === 0) {
							throwFwError(ERR_CODE_NO_ID);
						}

						var existingItem = this._findById(itemId);
						if (existingItem) {
							// 既に存在するオブジェクトの場合は値を更新
							for ( var prop in valueObj) {
								if (prop == idKey) {
									continue;
								}
								existingItem[prop] = valueObj[prop];
							}
							ret.push(existingItem);
						} else {
							var newItem = createItem(this, valueObj, itemChangeListener);

							actualNewItems.push(newItem);
							ret.push(newItem);

							this.items[newItem[idKey]] = newItem;
						}
					}

					if (actualNewItems.length > 0) {
						addUpdateLog(this, UPDATE_LOG_TYPE_CREATE, actualNewItems);
					}

					if (!isAlreadyInUpdate) {
						this.manager.endUpdate();
					}

					if ($.isArray(objOrArray)) {
						return ret;
					}
					return ret[0];
				},

				/**
				 * 指定されたIDのデータアイテムを返します。<br>
				 * 当該IDを持つアイテムをこのデータモデルが保持していない場合はnullを返します。<br>
				 * 引数にIDの配列を渡した場合に一部のIDのデータアイテムが存在しなかった場合、<br>
				 * 戻り値の配列の対応位置にnullが入ります。<br>
				 * （例：get(['id1', 'id2', 'id3']) でid2のアイテムがない場合、戻り値は [item1, null, item3] のようになる ）
				 *
				 * @memberOf DataModel
				 * @param {String|String[]} ID、またはその配列
				 * @returns {DataItem|DataItem[]} データアイテム、またはその配列
				 */
				get: function(idOrArray) {
					if ($.isArray(idOrArray)) {
						var ret = [];
						for ( var i = 0, len = idOrArray.length; i < len; i++) {
							ret.push(this._findById(idOrArray[i]));
						}
						return ret;
					}
					//引数の型チェックはfindById内で行われる
					return this._findById(idOrArray);
				},

				/**
				 * 指定されたIDのデータアイテムをこのデータモデルから削除します。<br>
				 * 当該IDを持つアイテムをこのデータモデルが保持していない場合はnullを返します。<br>
				 * 引数にIDの配列を渡した場合に一部のIDのデータアイテムが存在しなかった場合、<br>
				 * 戻り値の配列の対応位置にnullが入ります。<br>
				 * （例：remove(['id1', 'id2', 'id3']) でid2のアイテムがない場合、<br>
				 * 戻り値は [item1, null, item3]のようになります。）<br>
				 * 引数にID(文字列)またはデータアイテム以外を渡した場合はnullを返します。
				 *
				 * @memberOf DataModel
				 * @param {String|DataItem|String[]|DataItem[]} 削除するデータアイテム
				 * @returns {DataItem|DataItem[]} 削除したデータアイテム
				 */
				remove: function(objOrItemIdOrArray) {
					//removeで同時に複数のアイテムが指定された場合、イベントは一度だけ送出する。
					//そのため、事前にアップデートセッションに入っている場合はそのセッションを引き継ぎ、
					//入っていない場合は一時的にセッションを作成する。
					var isAlreadyInUpdate = manager ? manager.isInUpdate() : false;
					if (!isAlreadyInUpdate) {
						this.manager.beginUpdate();
					}

					var idKey = this.idKey;
					var ids = wrapInArray(objOrItemIdOrArray);

					var actualRemovedItems = [];
					var ret = [];

					for ( var i = 0, len = ids.length; i < len; i++) {
						if (!this.has(ids[i])) {
							//指定されたアイテムが存在しない場合はnull
							ret.push(null);
							continue;
						}

						var id = isString(ids[i]) ? ids[i] : ids[i][idKey];

						var item = this.items[id];

						item.removeEventListener('change', itemChangeListener);

						delete this.items[id];

						this.size--;

						ret.push(item);
						actualRemovedItems.push(item);
					}

					if (actualRemovedItems.length > 0) {
						addUpdateLog(this, UPDATE_LOG_TYPE_REMOVE, actualRemovedItems);
					}

					if (!isAlreadyInUpdate) {
						this.manager.endUpdate();
					}

					if ($.isArray(objOrItemIdOrArray)) {
						return ret;
					}
					return ret[0];
				},

				/**
				 * 指定されたデータアイテムを保持しているかどうかを返します。<br>
				 * 文字列が渡された場合はID(文字列)とみなし、 オブジェクトが渡された場合はデータアイテムとみなします。<br>
				 * オブジェクトが渡された場合、自分が保持しているデータアイテムインスタンスかどうかをチェックします。<br>
				 * 従って、同じ構造を持つ別のインスタンスを引数に渡した場合はfalseが返ります。<br>
				 * データアイテムインスタンスを引数に渡した場合に限り（そのインスタンスをこのデータモデルが保持していれば）trueが返ります。<br>
				 *
				 * @param {String|Object} idOrObj ID文字列またはデータアイテムオブジェクト
				 * @returns {Boolean} 指定されたIDのデータアイテムをこのデータモデルが保持しているかどうか
				 */
				has: function(idOrObj) {
					if (isString(idOrObj)) {
						return !!this._findById(idOrObj);
					} else if (typeof idOrObj === 'object') {
						//型の厳密性はitemsとの厳密等価比較によってチェックできるので、if文ではtypeofで充分
						return (idOrObj != null) && (idOrObj === this.items[idOrObj[this.idKey]]);
					} else {
						return false;
					}
				},

				/**
				 * 指定されたIDのデータアイテムを返します。 アイテムがない場合はnullを返します。
				 *
				 * @private
				 * @param {String} id データアイテムのID
				 * @returns {DataItem} データアイテム、存在しない場合はnull
				 */
				_findById: function(id) {
					//データアイテムは、取得系APIではIDを文字列型で渡さなければならない
					if (!isString(id)) {
						throwFwError(ERR_CODE_ID_MUST_BE_STRING);
					}
					var item = this.items[id];
					return item === undefined ? null : item;
				}
			});

			var targetModel = new DataModel(descriptor, manager);


			function itemChangeListener(event) {
				if (manager && manager.isInUpdate()) {
					addUpdateChangeLog(targetModel, event);
					return;
				}

				targetModel.dispatchEvent(createDataModelItemsChangeEvent([], [], [], [event]));
			}

			return targetModel;
		} /* End of createDataModel() */


		/* ----------------- DataModelコード ここまで ----------------- */


		/* --- DataModelManagerローカル ここから --- */

		if (!isValidNamespaceIdentifier(managerName)) {
			throwFwError(ERR_CODE_INVALID_MANAGER_NAME);
		}

		//データモデルマネージャインスタンスを生成
		var manager = new DataModelManager(managerName);

		//第2引数が省略される場合もあるので、厳密等価でなく通常の等価比較を行う
		if (namespace != null) {
			//指定された名前空間に、managerNameでマネージャを公開する
			var o = {};
			o[managerName] = manager;
			h5.u.obj.expose(namespace, o);
		}


		function getModelUpdateLogObj(modelName) {
			if (!manager._updateLogs[modelName]) {
				manager._updateLogs[modelName] = {};
			}

			return manager._updateLogs[modelName];
		}

		function addUpdateLog(model, type, items) {
			if (model.manager !== manager) {
				return;
			}

			var modelLogs = getModelUpdateLogObj(model.name);

			for ( var i = 0, len = items.length; i < len; i++) {
				var item = items[i];
				var itemId = item[model.idKey];

				if (!modelLogs[itemId]) {
					modelLogs[itemId] = [];
				}
				modelLogs[itemId].push({
					type: type,
					item: item
				});
			}
		}

		function addUpdateChangeLog(model, ev) {
			if (model.manager !== manager) {
				return;
			}

			var modelLogs = getModelUpdateLogObj(model.name);

			var itemId = ev.target[model.idKey];

			if (!modelLogs[itemId]) {
				modelLogs[itemId] = [];
			}
			modelLogs[itemId].push({
				type: UPDATE_LOG_TYPE_CHANGE,
				ev: ev
			});
		}

		/* --- DataModelManagerローカル ここまで --- */

		return manager;

	} /* End of createManager() */




	//TODO Localの場合は、テンポラリなManagerを渡す実装にする予定
	//	function createLocalDataModel(descriptor) {
	//		return createDataModel(descriptor);
	//	}

	//=============================
	// Expose to window
	//=============================


	/**
	 * DataModelの名前空間
	 *
	 * @name data
	 * @memberOf h5.core
	 * @namespace
	 */
	h5.u.obj.expose('h5.core.data', {
		/**
		 * 指定された名前のデータモデルマネージャを作成します。 第2引数が渡された場合、その名前空間にマネージャインスタンスを公開します。
		 *
		 * @memberOf h5.core.data
		 * @name h5.core.data.createManager
		 * @param {String} name マネージャ名
		 * @param {String} [namespace] 公開先名前空間
		 * @returns データモデルマネージャ
		 */
		createManager: createManager

	//		createLocalDataModel: createLocalDataModel,
	});
})();
