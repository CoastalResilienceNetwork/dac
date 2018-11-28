
define([
	    "dojo/_base/declare",
		"d3",
		"underscore",
		"dojo/json",
		"dojo/parser",
		"dojo/on",
		"dojo/aspect",
		"dojo/_base/array",
		"dojo/_base/html",
		"dojo/_base/window",
		"dojo/query",
		"dojo/dom",
		"dojo/dom-class",
		"dojo/dom-style",
		"dojo/dom-attr",
		"dojo/dom-construct",
		"dojo/dom-geometry",
		"dojo/_base/fx",
		"dojo/fx",
		"dojox/fx",
		"dijit/registry",
		"dijit/layout/ContentPane",
		"dijit/TitlePane",
		"dijit/layout/AccordionContainer",
		"dojox/widget/TitleGroup",
		"dijit/form/HorizontalSlider",
		"dijit/form/HorizontalRuleLabels",
		"esri/layers/ArcGISDynamicMapServiceLayer",
		"esri/layers/FeatureLayer",
		"esri/layers/GraphicsLayer",
		"esri/graphic",
		"esri/tasks/query",
		"esri/tasks/QueryTask",
		"esri/geometry/Extent",
		"esri/geometry/Point",
		"esri/InfoTemplate",
		"esri/geometry/screenUtils",
		"dojo/NodeList-traverse"
		], 


	function (declare,
			d3,
			_, 
			JSON,
			parser,
			on,
			aspect,
			array,
			html,
			win,			
			query,
			dom,
			domClass,
			domStyle,
			domAttr,
			domConstruct,
			domGeom,
			fx,
			coreFx,
			xFx,
			registry,
			ContentPane,
			TitlePane,
			AccordionContainer,
			TitleGroup,
			HorizontalSlider,
			HorizontalRuleLabels,
			DynamicMapServiceLayer,
			FeatureLayer,
			GraphicsLayer,
			Graphic,
			Query,
			QueryTask,
			Extent,
			Point,
			InfoTemplate,
			screenUtils
		  ) 
		
		{

		var dacTool = function(plugin, appData, appConfig){
			var self = this;
			this._plugin = plugin;
			this._app = this._plugin.app;
			this._container = this._plugin.container;
			this._plugin_directory = this._plugin.plugin_directory;
			this._legend = this._plugin.legendContainer;
			this._map = this._plugin.map;
			this._mapLayers = {};
			this._backgroundMapLayers = {};
			this._mapLayer = {};
			this._displayState = "closed";
			this._charts = {
				jobs:{
					chart:{}
				},
				dacJobs:{
					chart:{}
				},
				drive:{
					chart:{}
				}
			};
			this._extent = {
				"xmin": 0,
				"ymin": 0,
				"xmax": 0,
				"ymax": 0,
				"spatialReference": {
					"wkid": 102100,
					"latestWkid": 3857
				}
			};
			this._data = JSON.parse(appData);
			this._interface = JSON.parse(appConfig);
			
			on(this._map, "click", function(evt) {
				var pt = evt.mapPoint;
				if (self._displayState == "open" && self._mapLayer.id.indexOf("_blocks") >= 0) {
					self.identifyBlock(pt);
				}
			})
			
			this.initialize = function(){
				var region = "Los Angeles County";
				this._extent = self._interface.region[region].extent;
				
				domStyle.set(this._container, {
					"padding": "0px"
				});
				
				this.loadingDiv = domConstruct.create("div", {
					innerHTML:"<i class='fa fa-spinner fa-spin fa-3x fa-fw'></i>",
					style:"position:absolute; right: 10px; top:10px; width:40px; height:20x; line-height:20px; text-align:center; display:none;"
				}, this._container);
				
				this.loadLayers();
				this.loadInterface();
				this.loadJobsStats();
				this.loadJobsChart();
				this.loadDacJobsStats();
				this.loadDacJobsChart();
				this.loadHabitatStats();
				this.loadAccessStats();
				this.loadDacEnvironmentStats();
				this.loadDriveStats();
				this.loadDriveChart();
			}

			this.showTool = function(){
				this._map.setExtent(new Extent(this._extent), true);
				this._displayState = "open";
			} 

			this.hideTool = function(){
				if(!_.isEmpty(this._mapLayer)) {
					this._mapLayer.hide();
				}
				this._displayState = "closed";
			}
			
			this.closeTool = function(){
				if(!_.isEmpty(this._mapLayer)) {
					this._mapLayer.hide();
				}
				this._displayState = "closed";
			}
			
			this.loadLayers = function(){
				var serviceUrl = this._interface.service;
				var layers = this._interface.layers;
				
				_.each(_.keys(layers), function(layer) {
					if (layers[layer].type == "dynamic") {
						var mapLayer = new DynamicMapServiceLayer(serviceUrl, { id:layer });
						mapLayer.setVisibleLayers(layers[layer].ids);
						mapLayer.setImageFormat("png32");
					}
					if (layers[layer].type == "feature") {
						
						if (_.has(layers[layer], "template") && layers[layer].template == "enviro") {
							var template = new InfoTemplate();
							template.setTitle(function(graphic){
								return "<b>ID</b>: " + graphic.attributes["Census_Tract"];
							});
							template.setContent(function(graphic){
								var layerId = graphic.getLayer().id;
								var color = graphic.getShape().getFill();
								var content = "";
								
								if (layerId == "ces_score") {
									content += '<div class="plugin-dac-popup"><div class="stat"><div class="number" style="color:' + color.toHex() + ';">' + d3.format(",.1f")(graphic.attributes["CES3_Percentile"]) + '</div><div class="description">' + self._interface.field_alias_mapping["CES3_Percentile"] + '</div></div><div>';
									
									content += "<b>" + self._interface.field_alias_mapping["Total_Population"] + "</b>: " + d3.format(",.0f")(graphic.attributes["Total_Population"]) + "<br>";
									content += "<b>" + self._interface.field_alias_mapping["Pollution_Burden_Pctl"] + "</b>: " + d3.format(",.0f")(graphic.attributes["Pollution_Burden_Pctl"]) + "<br>";
									content += "<b>" + self._interface.field_alias_mapping["Pop_Char_Percentile"] + "</b>: " + d3.format(",.0f")(graphic.attributes["Pop_Char_Percentile"]) + "<br><br>";
									content += "<i>Indicator Percentile Scores</i>:<br>";
									
									var blackListFields = ["Census_Tract", "CES3_Percentile", "Pollution_Burden_Pctl", "Pop_Char_Percentile", "OBJECTID", "Total_Population"];
									var fields = _.difference(_.keys(graphic.attributes), blackListFields);
									_.each(fields, function(field) {
										content += "<b>" + self._interface.field_alias_mapping[field] + "</b>: " + d3.format(",.0f")(graphic.attributes[field]) + "<br>";
									})
								}
								if (layerId == "pollution_score") {
									content += '<div class="plugin-dac-popup"><div class="stat"><div class="number" style="color:' + color.toHex() + ';">' + d3.format(",.1f")(graphic.attributes["Pollution_Burden_Pctl"]) + '</div><div class="description">' + self._interface.field_alias_mapping["Pollution_Burden_Pctl"] + '</div></div><div>';
									
									content += "<b>" + self._interface.field_alias_mapping["Total_Population"] + "</b>: " + d3.format(",.0f")(graphic.attributes["Total_Population"]) + "<br><br>";
									content += "<i>Indicator Percentile Scores</i>:<br>";
									
									var blackListFields = ["Census_Tract", "Pollution_Burden_Pctl", "OBJECTID", "Total_Population"];
									var fields = _.difference(_.keys(graphic.attributes), blackListFields);
									_.each(fields, function(field) {
										content += "<b>" + self._interface.field_alias_mapping[field] + "</b>: " + d3.format(",.0f")(graphic.attributes[field]) + "<br>";
									})
								}
								if (layerId == "pop_score") {
									content += '<div class="plugin-dac-popup"><div class="stat"><div class="number" style="color:' + color.toHex() + ';">' + d3.format(",.1f")(graphic.attributes["Pop_Char_Percentile"]) + '</div><div class="description">' + self._interface.field_alias_mapping["Pop_Char_Percentile"] + '</div></div><div>';
									
									content += "<b>" + self._interface.field_alias_mapping["Total_Population"] + "</b>: " + d3.format(",.0f")(graphic.attributes["Total_Population"]) + "<br><br>";
									content += "<i>Indicator Percentile Scores</i>:<br>";
									
									var blackListFields = ["Census_Tract", "Pop_Char_Percentile", "OBJECTID", "Total_Population"];
									var fields = _.difference(_.keys(graphic.attributes), blackListFields);
									_.each(fields, function(field) {
										content += "<b>" + self._interface.field_alias_mapping[field] + "</b>: " + d3.format(",.0f")(graphic.attributes[field]) + "<br>";
									})
								}
								
								return content;
							});
						}
						
						
						if (_.has(layers[layer], "template") && layers[layer].template == "access") {
							var template = new InfoTemplate();
							template.setTitle(function(graphic){
								return "<b>ID</b>: " + graphic.attributes["Census_Tract_ID"];
							});
							template.setContent(function(graphic){
								var relative = graphic.attributes["Relative_Distance_To_Beach"].replace(" for LA County", "");
								switch (relative){
									case "Higher than average":
										color = "#D62F27";
										break;
									case "About average":
										color = "#FFE08C";
										break;
									case "Lower than average":
										color = "#1A9951"
										break;
									default:
										color = "#787878"
										break;
								}
								
								var content = "";
								content += "<b>Median Income</b>: $" + d3.format(",.0f")(graphic.attributes["Median_Income"]) + "<br>";
								content += "<b>Coastal Access</b>: " + graphic.attributes["Beach_Name"] + "<br>";
								content += "<b>Distance to Coastal Access</b>: " + d3.format(".1f")(parseFloat(graphic.attributes["Distance_To_Beach"])) + " mi<br>";
								content += "<div style='margin:10px 0px;font-weight:bold;text-align:center;color:" + color + ";'>" + relative + " for the county</div>";
								
								self._mapLayers["coastal_access_line"].setDefinitionExpression("Census_Tract_ID = '" + graphic.attributes["Census_Tract_ID"] + "'")
								
								window.setTimeout(function() {
									var pt = graphic.geometry.getCentroid();
									self._map.infoWindow.show(pt);
								}, 250);
								
								return content;
							});
							
							on(self._map.infoWindow, "hide", function(evt) {
								if (self._map.getLayer("coastal_access_tract").visible) {
									self._mapLayers["coastal_access_line"].setDefinitionExpression("Census_Tract_ID = ''");
								}
								self._map.graphics.clear();
								self._map.infoWindow.clearFeatures();
							})
						}
		
						var mapLayer = new FeatureLayer(serviceUrl + "/" + layers[layer].id, { 
							id:layer, 
							outFields:layers[layer].outFields,
							mode: FeatureLayer.MODE_SNAPSHOT,
							infoTemplate: template 
						});
						
					}
					
					on(mapLayer,"update-start",function(){
						domStyle.set(self.loadingDiv,"display", "block");
					})
					on(mapLayer,"update-end",function(){
						domStyle.set(self.loadingDiv,"display", "none");
					})
					
					if (layer.indexOf("habitat") >= 0) {
						self._backgroundMapLayers[layer] = mapLayer
					} else {
						self._mapLayers[layer] = mapLayer;
					}
					
					self._map.addLayer(mapLayer);
					mapLayer.hide();
					
				})
			}
			
			this.updateMapLayers = function(layer) {
				_.each(_.keys(this._mapLayers), function(key) {
					self._mapLayers[key].hide();
				});
				if (layer != "") {
					this._mapLayer = this._mapLayers[layer];
					this._mapLayer.show();
				}
			}
			
			this.updateHabitatLayer = function() {
				var layer = query(".plugin-dac .toggle-btn.habitat input[type=radio]:checked")[0].value;
				_.each(_.keys(this._backgroundMapLayers), function(key) {
					self._backgroundMapLayers[key].hide();
				});
				if (layer != "habitat_none") {
					this._backgroundMapLayers[layer].show();
				}
			}
			
			this.updateJobsLayer = function() {
				var region = this._interface.region[this._region].id;
				var group = query(".plugin-dac .toggle-btn.economics input[type=radio]:checked")[0].value;
				group = (group == "drive") ? "all_jobs" : group;
				var income = this._interface.controls.slider.economic.values[this.economicSlider.get("value")];
				income = (income != "") ? "_" + income : income;
				var blocks = dom.byId("plugin-dac-togglebutton-economics-blocks").checked;
				
				var layer = (blocks) ? region + "_wac_" + group + "_blocks" + income : region + "_wac_" + group + "_density" + income;
				this.updateMapLayers(layer);
			}
			
			this.updateAccessLayer = function() {
				this.updateMapLayers("");
				this._mapLayer = this._mapLayers["coastal_access_tract"];
				this._mapLayer.show();
				this._mapLayers["coastal_access_line"].setDefinitionExpression("Census_Tract_ID = ''");
				this._mapLayers["coastal_access_line"].show();
				this._mapLayers["coastal_access_beach"].show();
			}
			
			this.updateDacJobsLayer = function() {
				var income = this._interface.controls.slider.economic.values[this.dacJobsSlider.get("value")];
				income = (income != "") ? "_" + income : income;
				var blocks = dom.byId("plugin-dac-togglebutton-dac-blocks").checked;
				
				var layer = (blocks) ? "rac_blocks" + income : "rac_density" + income;
				this.updateMapLayers(layer);
			}
			
			this.updateEnviroLayer = function() {
				var layer = query(".plugin-dac .toggle-btn.enviro input[type=radio]:checked")[0].value;
				this.updateMapLayers(layer);
			}
			
						
			this.loadInterface = function() {
				var self = this;
				domStyle.set(this._container, { 
					"overflow": "visible"
				});
				
				//empty layout containers
			    this._containerPane = new ContentPane({
					id: "plugin-dac-" + self._map.id,
					style: "position:relative; overflow: visible; width:100%; height:100%;",
					className: 'cr-dojo-dijits'
			    });
			    this._containerPane.startup();
				this._container.appendChild(this._containerPane.domNode);
				
				this.inputsPane = new ContentPane({});
				this._containerPane.domNode.appendChild(this.inputsPane.domNode);
			    domStyle.set(this.inputsPane.containerNode, {
					"position": "relative",
					"overflow": "visible",
					"background": "none",
					"border": "none",
					"width": "100%",
					"height": "auto",
					"padding": "20px 0px 0px 0px"
				});
				on(this._map, "resize", function() {
					domStyle.set(self.inputsPane.containerNode, { "width": "100%", "height": "auto" });
				});
				
				domConstruct.create("div", { 
					class:"plugin-desc",
					innerHTML:"This work explores the relationship between coastal habitats and <b><a href='http://www.cpuc.ca.gov/discom/' target='_blank'>disadvantaged communities</a></b>. It explores the questions of whether the potential loss of coastal habitats to sea level rise might have a disproportionate impact on low income jobs and low income residences within Los Angeles County."
				}, this.inputsPane.containerNode);
				
				var display = (_.keys(this._interface.region).length > 1) ? "block" : "none";
				
				var table = domConstruct.create("div", {
					style:"position:relative;"
				}, this.inputsPane.containerNode);
				
				this.createRegionControls(table);
				this.createBackgroundControls(table);
				this.createEconomicControls(table);
				this.createAccessControls(table);
				this.createDacControls(table);
				
				//var tr = domConstruct.create("tr", {}, table);
				var opacityTd = domConstruct.create("div", {}, table);
				
				this.opacityToggleDiv = domConstruct.create("div", {
					className: "section-div",
					style:"height:40px;margin-bottom: 20px;"
				}, opacityTd);
				
				var opacity = domConstruct.create("div", {
					className: "utility-control",
					innerHTML: '<span class="slr-' + this._map.id + '-opacity"><b>Opacity</b>&nbsp;<i class="fa fa-adjust"></i></span>'
				}, this.opacityToggleDiv);
				
				on(opacity,"click", function() {
					var status = domStyle.get(self.opacityContainer, "display");
					var display = (status == "none") ? "block" : "none";
					domStyle.set(self.opacityContainer, "display", display);
				})
				
				this.opacityContainer = domConstruct.create("div", {
					className: "utility"
				}, this.opacityToggleDiv);
				
				//opacity slider
				this.opacitySlider = new HorizontalSlider({
			        name: "opacitySlider",
			        value: 1,
			        minimum: 0,
			        maximum: 1,
			        intermediateChanges: true,
			        showButtons: false,
					disabled: false,
			        style: "width:75px; display:inline-block; margin:0px; background:none;",
			        onChange: function(value){
						_.each(_.keys(self._mapLayers), function(key) {
							self._mapLayers[key].setOpacity(Math.abs(value))
						});
			        }
			    });
				this.opacityContainer.appendChild(this.opacitySlider.domNode);
			}
			
			this.createRegionControls = function(table) {
				/*Region selector and summary button*/
				//var tr = domConstruct.create("tr", {}, table);
				var regionTd = domConstruct.create("div", { style:"padding:0px 20px;" }, table);
				
				var regionText = domConstruct.create("div", {
					style:"position:relative;margin-bottom:5px;text-align:left;font-size:14px;",
					innerHTML: '<span class="info-circle fa-stack fa dac-' + this._map.id + '-region"><i class="fa fa-circle fa-stack-1x"></i><span class="fa-stack-1x info-circle-text">1</span></span><b> Choose a Geography</b>'
				}, regionTd);
				
				var regionSelectDiv = domConstruct.create("div", { 
					className: "styled-select",
					style:"width:260px;display:inline-block;" 
				}, regionTd);
				this.regionSelect = dojo.create("select", { name: "regionType"}, regionSelectDiv);
				_.forEach(_.keys(this._interface.region), function(key) {
					domConstruct.create("option", { innerHTML: key, value: key }, self.regionSelect);
				});
				on(this.regionSelect, "change", function() {
					self._region = this.value;
					self._extent = self._interface.region[self._region].extent;
					self._map.setExtent(new Extent(self._extent), true);
					
					var display = (self._region == "Los Angeles County") ? "none" : "flex";
					query("label[for=plugin-dac-togglebutton-economics-drive-" + self._map.id + "]").style("display", display);
					
					if (display == "flex") {
						self.updateDriveStats();
						self.updateDriveChart();
					}
					
					var value = query(".plugin-dac .toggle-btn.economics input[type=radio]:checked")[0].value;
					if (value == "drive" && display == "none") {
						query(".plugin-dac .toggle-btn.economics input[type=radio]")[0].click();
					} else {
						self.updateJobsStats();
						self.updateJobsChart();
						self.updateRegion();
					}
					
				});
				this.regionSelect.value = _.first(this.regionSelect.options).value;
				this._region = this.regionSelect.value;
				
				this.downloadReport = domConstruct.create("div", { className:"downloadButton dac-report", innerHTML:'<i class="fa fa-file-pdf-o downloadIcon"></i><span class="downloadText">Data Sources</span>' }, regionTd);
				on(this.downloadReport,"mouseover", function(){
					if (self._region && self._region != "") {
						domStyle.set(this, "background", "#0096d6");
					}
				});
				on(this.downloadReport,"mouseout", function(){
					if (self._region && self._region != "") {
						 domStyle.set(this, "background", "#2B2E3B");
					}
				});
				on(this.downloadReport,"click", function(){
					 if (self._region && self._region != "") {
						var url = self._interface.region[self._region].download.report;
						url = url.replace("HOSTNAME-", window.location.href);
						window.open(url, "_blank");
					 }
				});
			}
			
			this.toggleControlContainer = function(section, state) {
				var display = (state == "hide") ? "none" : "block";
				domStyle.set(self[section + "ControlsContainer"], "display", display);
				
				var background = (display == "block") ? "#fafafa" : "none";
				domStyle.set(self[section + "ToggleDiv"], "background", background);
				
				var margin = (display == "block") ? "0px" : "20px";
				domStyle.set(self[section + "ToggleDiv"], "margin-top", margin);
				
				var padding = (display == "block") ? "20px" : "0px 20px 0px 20px";
				domStyle.set(self[section + "ContentDiv"], "padding", padding);
				
				var toggleIcon = query(".tg-toggle-icon", self[section + "ToggleDiv"])[0];
				if (display == "block") {
					domClass.replace(toggleIcon, "fa-minus","fa-plus");
				} else {
					domClass.replace(toggleIcon, "fa-plus","fa-minus");
				}
				
				self._map.infoWindow.hide();
			}
			
			this.updateRegion = function() {
				var jobs = domStyle.get(self.economicControlsContainer, "display") == "block";
				 if (jobs) {
					this.updateJobsLayer();
				 }
			}
			
			this.createBackgroundControls = function(table) {
				/*Coastal habitat section*/
				//var tr = domConstruct.create("tr", {}, table);
				var habitatTd = domConstruct.create("div", {}, table);
				
				this.habitatToggleDiv = domConstruct.create("div", {
					className: "section-div"
				}, habitatTd);
				
				this.habitatContentDiv = domConstruct.create("div", {
					className: "content-div"
				}, self.habitatToggleDiv);
							
				var sectionToggle = domConstruct.create("div", {
					innerHTML:'<i class="fa fa-plus tg-toggle-icon"></i><span class="info-circle fa-stack fa dac-' + self._map.id + '-togglegroup_habitat"><i class="fa fa-circle fa-stack-1x"></i><span class="fa-stack-1x info-circle-text">2</span></span><b> Choose a Coastal Habitat or Conservation Strategy</b>',
					style:"font-size:14px;margin-left:-12px;cursor:pointer;"
				}, this.habitatContentDiv);
				
				on(sectionToggle, "click", function(evt) {
					var state = (domStyle.get(self.habitatControlsContainer, "display") == "block") ? "hide" : "show";
					self.toggleControlContainer("habitat", state);
					
					if (state == "show") {
						self.toggleControlContainer("economic", "hide");
						self.toggleControlContainer("access", "hide");
						self.toggleControlContainer("dac", "hide");
					}
				});
				
				this.habitatControlsContainer = domConstruct.create("div", {
					style:"display:none;"
				}, this.habitatContentDiv );
				
				var containerDiv = domConstruct.create("div", {
					className: "toggle-btn habitat"
				}, self.habitatControlsContainer);
				
				domConstruct.create("input", { 
					type: "radio", 
					value: "habitat_general", 
					name: "background",
					checked: false,
					id: "plugin-dac-togglebutton-habitat-habitat_general-" + self._map.id
				}, containerDiv);
				
				domConstruct.create("label", { 
					for: "plugin-dac-togglebutton-habitat-habitat_general-" + self._map.id,
					innerHTML: "Coastal<br>Habitats"
				}, containerDiv);
				
				domConstruct.create("input", { 
					type: "radio", 
					value: "habitat_strategy", 
					name: "background",
					checked: false, 
					id: "plugin-dac-togglebutton-habitat-habitat_strategy-" + self._map.id
				}, containerDiv);
				
				domConstruct.create("label", { 
					for: "plugin-dac-togglebutton-habitat-habitat_strategy-" + self._map.id,
					innerHTML: "Conservation<br>Strategies"
				}, containerDiv);
				
				domConstruct.create("input", { 
					type: "radio", 
					value: "habitat_none", 
					name: "background",
					checked: true, 
					id: "plugin-dac-togglebutton-habitat-habitat_none-" + self._map.id
				}, containerDiv);
				
				domConstruct.create("label", { 
					for: "plugin-dac-togglebutton-habitat-habitat_none-" + self._map.id,
					innerHTML: "No<br>Background"
				}, containerDiv);
				
				on(query(".plugin-dac .toggle-btn.habitat input"), "change", function(input) {
					self.updateHabitatStats();
					self.updateHabitatLayer();
				});
				
				this.habitatStatsDiv = domConstruct.create("div", {
					style:"position:relative;"
				}, self.habitatControlsContainer);
			}
			
			this.createEconomicControls = function(table) {
				/* Economics section */
				//var tr = domConstruct.create("tr", {}, table);
				var economicTd = domConstruct.create("div", {}, table);
				
				this.economicToggleDiv = domConstruct.create("div", {
					className: "section-div"
				}, economicTd);
				
				this.economicContentDiv = domConstruct.create("div", {
					className: "content-div"
				}, this.economicToggleDiv);
							
				var sectionToggle = domConstruct.create("div", {
					innerHTML:'<i class="fa fa-plus tg-toggle-icon"></i><span class="info-circle fa-stack fa dac-' + self._map.id + '-togglegroup_economics"><i class="fa fa-circle fa-stack-1x"></i><span class="fa-stack-1x info-circle-text">3</span></span><b> Learn About Coastal Jobs</b>',
					style:"font-size:14px;margin-left:-12px;cursor:pointer;"
				}, this.economicContentDiv);
				
				on(sectionToggle, "click", function(evt) {
					var state = (domStyle.get(self.economicControlsContainer, "display") == "block") ? "hide" : "show";
					self.toggleControlContainer("economic", state);
					
					if (state == "show") {
						self.toggleControlContainer("habitat", "hide");
						self.toggleControlContainer("access", "hide");
						self.toggleControlContainer("dac", "hide");
						self.updateJobsLayer();
					} else {
						self.updateMapLayers("");
					}
				});
				
				this.economicControlsContainer = domConstruct.create("div", {
					style:"display:none;"
				}, this.economicContentDiv);
				
				var containerDiv = domConstruct.create("div", {
					className: "toggle-btn economics",
					style:"position:relative;"
				}, this.economicControlsContainer);
				
				domConstruct.create("input", { 
					type: "radio", 
					value: "all_jobs", 
					name: "jobs",
					checked: true,
					id: "plugin-dac-togglebutton-economics-all_jobs-" + self._map.id
				}, containerDiv);
				
				domConstruct.create("label", { 
					for: "plugin-dac-togglebutton-economics-all_jobs-" + self._map.id,
					innerHTML: "All Coastal<br>Jobs"
				}, containerDiv);
				
				domConstruct.create("input", { 
					type: "radio", 
					value: "dac_jobs", 
					name: "jobs", 
					id: "plugin-dac-togglebutton-economics-dac_jobs-" + self._map.id
				}, containerDiv);
				
				domConstruct.create("label", { 
					for: "plugin-dac-togglebutton-economics-dac_jobs-" + self._map.id,
					innerHTML: "Jobs held by Disadvantaged<br>Community Residents"
				}, containerDiv);
				
				domConstruct.create("input", { 
					type: "radio", 
					value: "drive", 
					name: "jobs", 
					id: "plugin-dac-togglebutton-economics-drive-" + self._map.id
				}, containerDiv);
				
				domConstruct.create("label", { 
					for: "plugin-dac-togglebutton-economics-drive-" + self._map.id,
					style:"display:none;",
					innerHTML: "Distance Traveled to Work"
				}, containerDiv);
				
				on(query(".plugin-dac .toggle-btn.economics input"), "change", function(evt) {
					var value = evt.target.value;
					if (value != "drive") {
						domStyle.set(self.jobsStatsChartDiv, "display", "block");
						domStyle.set(self.jobsDriveDiv, "display", "none");
						self.updateJobsStats();
						self.updateJobsChart();
						self.updateJobsLayer();
					} else {
						domStyle.set(self.jobsStatsChartDiv, "display", "none");
						domStyle.set(self.jobsDriveDiv, "display", "block");
						self.updateDriveStats();
						self.updateDriveChart();
					}
				});
				
				var controlsContainerDiv = domConstruct.create("div", {
					className:"controls-container"
				}, this.economicControlsContainer);
							
				
				this.jobsStatsChartDiv = domConstruct.create("div", {
					style:"position:relative;display:block;"
				}, controlsContainerDiv);
				
				this.jobsDriveDiv = domConstruct.create("div", {
					style:"position:relative;display:none;"
				}, controlsContainerDiv);
				
				var economicControlsContainer = domConstruct.create("div", {
					style:"position:relative;padding:40px 20px 0px 20px;"
				}, controlsContainerDiv);
				
				//income slider
				this.economicSliderDiv = domConstruct.create("div", {
					id: "dac-" + self._map.id + "-slider-economics-income",
					style:"position:relative;margin: 0px 0px 20px 0px; height: 55px;"
				}, economicControlsContainer)
				
			    var economicSliderLabel = domConstruct.create("div", {
					innerHTML: "Map density of jobs by earnings ($/month):",
					style:"margin: 0px 0px 10px 0px;font-weight:bold;"
				}, this.economicSliderDiv);
				
				this.economicSlider = new HorizontalSlider({
			        name: "economics",
			        value: 3,
			        minimum: 0,
			        maximum: 3,
			        discreteValues: self._interface.controls.slider.economic.values.length,
			        showButtons: false,
					disabled: false,
			        style: "width:100%; background:none;",
			        onChange: function(value){
						self.updateJobsLayer();
			        }
			    });
			    this.economicSliderDiv.appendChild(this.economicSlider.domNode);

			    var economicSliderLabels = new HorizontalRuleLabels({
			    	container: 'bottomDecoration',
			    	count:  self._interface.controls.slider.economic.labels.length,
			    	labels: self._interface.controls.slider.economic.labels,
			    	style: "margin-top: 5px; font-size:12px;"
			    });
			    this.economicSlider.addChild(economicSliderLabels);
				
				var checkBoxContainer = domConstruct.create("div", {
					id: "dac-" + self._map.id + "-checkBox-economics-income",
					style:"position:relative;padding:0px 20px 0px 20px;	"
				}, controlsContainerDiv);
				
				var checkBoxDiv = domConstruct.create("label", { 
					for: "plugin-dac-togglebutton-economics-blocks",
					className:"styled-checkbox",
					style:"display:inline-block;max-width:350px;margin-left:5px;",
					innerHTML: ""
				}, checkBoxContainer)
				
				this.economicCheckBox = domConstruct.create("input", {
					type:"checkbox",
					value: "blocks",
					name:"blocks",
					id:"plugin-dac-togglebutton-economics-blocks",
					disabled:false,
					checked:false
				}, checkBoxDiv);
				
				var checkBoxLabel = domConstruct.create("div", {
					innerHTML: "<span>Map jobs by census blocks</span>",
					style:"display:inline-block;"
				}, checkBoxDiv);
				
				on(this.economicCheckBox, "change", function(input) {
					self.updateJobsLayer();
				});
				
				/* end of economics */
			}
			this.createAccessControls = function(table) {
				/*Coastal Access section*/
				//var tr = domConstruct.create("tr", {}, table);
				var accessTd = domConstruct.create("div", {}, table);
				
				this.accessToggleDiv = domConstruct.create("div", {
					className: "section-div"
				}, accessTd);
				
				this.accessContentDiv = domConstruct.create("div", {
					className: "content-div"
				}, this.accessToggleDiv);
							
				var sectionToggle = domConstruct.create("div", {
					innerHTML:'<i class="fa fa-plus tg-toggle-icon"></i><span class="info-circle fa-stack fa dac-' + self._map.id + '-coastal_access"><i class="fa fa-circle fa-stack-1x"></i><span class="fa-stack-1x info-circle-text">4</span></span><b> Learn About Coastal Access</b>',
					style:"font-size:14px;margin-left:-12px;cursor:pointer;"
				}, this.accessContentDiv);
				
				on(sectionToggle, "click", function(evt) {
					var state = (domStyle.get(self.accessControlsContainer, "display") == "block") ? "hide" : "show";
					self.toggleControlContainer("access", state);
					
					if (state == "show") {
						self.toggleControlContainer("habitat", "hide");
						self.toggleControlContainer("economic", "hide");
						self.toggleControlContainer("dac", "hide");
						self.updateAccessLayer();
					} else {
						self.updateMapLayers("");
					}
				});
				
				var containerDiv = domConstruct.create("div", {
					className: "toggle-btn access"
				}, this.accessContentDiv);
				
				this.accessControlsContainer = domConstruct.create("div", {
					className:"controls-container",
					style:"display:none;"
				}, this.accessContentDiv);
				
				this.accessStatsDiv = domConstruct.create("div", {
					style:"position:relative;"
				}, self.accessControlsContainer);
				
				domConstruct.create("div", {
					style: "line-height: 14px; text-align: center;font-size: 13px;padding: 10px 0px 0px 0px;color: #777777;",
					innerHTML:"coastal access points include sandy beaches with facilities"
				}, self.accessControlsContainer);
				
				domConstruct.create("div", {
					style: "line-height: 14px; text-align: center;font-size: 12px;padding: 3px 20px 0px 20px;color: #777777;",
					innerHTML:"-- click on a census tract in the map for more details --"
				}, self.accessControlsContainer);
				
				
			}
			
			this.createDacControls = function(table) {
				/*CalEviroScreen 3.0 section*/
				//var tr = domConstruct.create("tr", {}, table);
				var enviroTd = domConstruct.create("div", {}, table);
				
				this.dacToggleDiv = domConstruct.create("div", {
					className: "section-div"
				}, enviroTd);
				
				this.dacContentDiv = domConstruct.create("div", {
					className: "content-div"
				}, this.dacToggleDiv);
				
				var sectionToggle = domConstruct.create("div", {
					innerHTML: '<i class="fa fa-plus tg-toggle-icon"></i><span class="info-circle fa-stack fa dac-' + self._map.id + '-dac"><i class="fa fa-circle fa-stack-1x"></i><span class="fa-stack-1x info-circle-text">5</span></span><b> Learn About Disadvantaged Communities</b>',
					style:"font-size:14px;margin-left:-12px;cursor:pointer;"
				}, this.dacContentDiv);
				
				on(sectionToggle, "click", function(evt) {
					var state = (domStyle.get(self.dacControlsContainer, "display") == "block") ? "hide" : "show";
					self.toggleControlContainer("dac", state);
					
					if (state == "show") {
						self.toggleControlContainer("habitat", "hide");
						self.toggleControlContainer("economic", "hide");
						self.toggleControlContainer("access", "hide");
						
						var group = query(".plugin-dac .toggle-btn.dac input[type=radio]:checked")[0].value;
						if (group == "jobs") {
							self.updateDacJobsLayer();
						} else {
							self.updateEnviroLayer();
						}
					} else {
						self.updateMapLayers("");
					}
					
				});
				
				this.dacControlsContainer = domConstruct.create("div", {
					style:"display:none;"
				}, this.dacContentDiv);
				
				var containerDiv = domConstruct.create("div", {
					className: "toggle-btn dac",
					style:"position:relative;"
				}, this.dacControlsContainer);
				
				domConstruct.create("input", { 
					type: "radio", 
					value: "jobs", 
					name: "dac",
					checked: true,
					id: "plugin-dac-togglebutton-dac-dac_jobs-" + self._map.id
				}, containerDiv);
				
				domConstruct.create("label", { 
					for: "plugin-dac-togglebutton-dac-dac_jobs-" + self._map.id,
					innerHTML: "Jobs"
				}, containerDiv);
				
				domConstruct.create("input", { 
					type: "radio", 
					value: "environment", 
					name: "dac", 
					id: "plugin-dac-togglebutton-dac-enviro_health-" + self._map.id
				}, containerDiv);
				
				domConstruct.create("label", { 
					for: "plugin-dac-togglebutton-dac-enviro_health-" + self._map.id,
					innerHTML: "Environmental<br>Health"
				}, containerDiv);
				
				on(query(".plugin-dac .toggle-btn.dac input"), "change", function(input) {
					
					var group = input.target.value;
					if (group == "jobs") {
						domStyle.set(self.dacJobsControlsContainer, "display", "block");
						domStyle.set(self.dacEnvironmentControlsContainer, "display", "none");
						self.updateDacJobsLayer();
					} else {
						domStyle.set(self.dacJobsControlsContainer, "display", "none");
						domStyle.set(self.dacEnvironmentControlsContainer, "display", "block");
						
						var w = domGeom.getContentBox(query("label[for=plugin-dac-togglebutton-enviro-ces_score-" + self._map.id + "]")[0]).w;
						var l = domGeom.getMarginBox(query("label[for=plugin-dac-togglebutton-enviro-ces_score-" + self._map.id + "]")[0]).l;
						var left = w + l + 5;
						query(".toggle-btn.enviro .enviro-arrow").style("left", left + "px");
						
						var w = domGeom.getContentBox(query("label[for=plugin-dac-togglebutton-enviro-pollution_score-" + self._map.id + "]")[0]).w;
						var l = domGeom.getMarginBox(query("label[for=plugin-dac-togglebutton-enviro-pollution_score-" + self._map.id + "]")[0]).l;
						var left = w + l + 5;
						query(".toggle-btn.enviro .enviro-times").style("left", left + "px");
						
						self.updateDacEnvironmentStats();
						self.updateEnviroLayer();
					}
					
				});
				
				this.dacJobsControlsContainer = domConstruct.create("div", {
					className:"controls-container"
				}, this.dacControlsContainer);
				
				this.dacJobsStatsChartDiv = domConstruct.create("div", {
					style:"position:relative;"
				}, this.dacJobsControlsContainer);
				
				var dacJobsControlsContainer = domConstruct.create("div", {
					style:"position:relative;padding:40px 20px 0px 20px;"
				}, this.dacJobsControlsContainer);
				
				//income slider
				this.dacJobsSliderDiv = domConstruct.create("div", {
					id: "dac-" + self._map.id + "-slider-dac-jobs",
					style:"position:relative;margin: 0px 0px 20px 0px; height: 55px;"
				}, dacJobsControlsContainer)
				
			    var dacJobsSliderLabel = domConstruct.create("div", {
					innerHTML: "Map density of jobs by earnings ($/month):",
					style:"margin: 0px 0px 10px 0px;font-weight:bold;"
				}, this.dacJobsSliderDiv);
				
				this.dacJobsSlider = new HorizontalSlider({
			        name: "dac-jobs",
			        value: 3,
			        minimum: 0,
			        maximum: 3,
			        discreteValues: self._interface.controls.slider.economic.values.length,
			        showButtons: false,
					disabled: false,
			        style: "width:100%; background:none;",
			        onChange: function(value){
						self.updateDacJobsLayer();
			        }
			    });
			    this.dacJobsSliderDiv.appendChild(this.dacJobsSlider.domNode);

			    var dacJobsSliderLabels = new HorizontalRuleLabels({
			    	container: 'bottomDecoration',
			    	count:  self._interface.controls.slider.economic.labels.length,
			    	labels: self._interface.controls.slider.economic.labels,
			    	style: "margin-top: 5px; font-size:12px;"
			    });
			    this.dacJobsSlider.addChild(dacJobsSliderLabels);
				
				
				var checkBoxContainer = domConstruct.create("div", {
					id: "dac-" + self._map.id + "-checkBox-dac-blocks",
					style:"position:relative;padding:0px 20px 0px 20px;"
				}, this.dacJobsControlsContainer);
				
				var checkBoxDiv = domConstruct.create("label", { 
					for: "plugin-dac-togglebutton-dac-blocks",
					className:"styled-checkbox",
					style:"display:inline-block;max-width:350px;margin-left:5px;",
					innerHTML: ""
				}, checkBoxContainer)
				
				this.dacJobsCheckBox = domConstruct.create("input", {
					type:"checkbox",
					value: "blocks",
					name:"dac-blocks",
					id:"plugin-dac-togglebutton-dac-blocks",
					disabled:false,
					checked:false
				}, checkBoxDiv);
				
				var checkBoxLabel = domConstruct.create("div", {
					innerHTML: "<span>Map jobs by census blocks</span>",
					style:"display:inline-block;"
				}, checkBoxDiv);
				
				on(this.dacJobsCheckBox, "change", function(input) {
					self.updateDacJobsLayer();
				});
				
				this.dacEnvironmentControlsContainer = domConstruct.create("div", {
					className: "controls-container",
					style:"display:none"
				}, this.dacControlsContainer);
									
				var containerDiv = domConstruct.create("div", {
					className: "toggle-btn enviro"
				}, this.dacEnvironmentControlsContainer);
				
				domConstruct.create("input", { 
					type: "radio", 
					value: "ces_score", 
					name: "dac-enviro",
					checked: true,
					id: "plugin-dac-togglebutton-enviro-ces_score-" + self._map.id
				}, containerDiv);
				
				domConstruct.create("label", { 
					for: "plugin-dac-togglebutton-enviro-ces_score-" + self._map.id,
					innerHTML: "CalEnviro-<br>Screen 3.0"
				}, containerDiv);
				
				domConstruct.create("input", { 
					type: "radio", 
					value: "pollution_score", 
					name: "dac-enviro",
					checked:false , 
					id: "plugin-dac-togglebutton-enviro-pollution_score-" + self._map.id
				}, containerDiv);
				
				domConstruct.create("label", { 
					for: "plugin-dac-togglebutton-enviro-pollution_score-" + self._map.id,
					innerHTML: "Pollution<br>Burden"
				}, containerDiv);
				
				domConstruct.create("input", { 
					type: "radio", 
					value: "pop_score", 
					name: "dac-enviro",
					checked: false, 
					id: "plugin-dac-togglebutton-enviro-pop_score-" + self._map.id
				}, containerDiv);
				
				domConstruct.create("label", { 
					for: "plugin-dac-togglebutton-enviro-pop_score-" + self._map.id,
					innerHTML: "Population<br>Characteristics"
				}, containerDiv);
				
				domConstruct.create("div", {
					innerHTML: '<i class="fa fa-arrow-right" aria-hidden="true"></i>',
					className:"enviro-arrow",
					style:"position: absolute;left: 110px;width: 30px;text-align: center;font-size: 16px;top: 18px;"
				}, containerDiv);
				
				domConstruct.create("div", { 
					innerHTML: '<i class="fa fa-times" aria-hidden="true"></i>',
					className:"enviro-times",
					style:"position: absolute;left: 247px;width: 30px;text-align: center;font-size: 16px;top: 18px;"
				}, containerDiv);
				
				on(query(".plugin-dac .toggle-btn.enviro input"), "change", function(input) {
					self.updateEnviroLayer();
					self.updateDacEnvironmentStats();
					self._map.infoWindow.hide();
				});
								
				this.dacEnvironmentStatsDiv = domConstruct.create("div", {
					style:"position:relative;"
				}, self.dacEnvironmentControlsContainer);
				
				domConstruct.create("div", {
					style: "line-height: 14px; text-align: center;font-size: 12px;padding: 10px 20px 10px 20px;color: #777777;",
					innerHTML:"-- click on a census tract in the map for more details --"
				}, this.dacEnvironmentControlsContainer);
			
			}

			this.loadHabitatStats = function() {
				var contentDiv = domConstruct.create("div", {
					className: "stats-div",
					style:"margin-top: 10px;"
				}, this.habitatStatsDiv);
				
				var containerDiv = domConstruct.create("div", {
					className: "stats-container"
				}, contentDiv);
				
			}
			
			this.updateHabitatStats = function() {
				var group = query(".plugin-dac .toggle-btn.habitat input[type=radio]:checked")[0].value;
				var containerDiv = query(".stats-container", this.habitatStatsDiv)[0];
				domConstruct.empty(containerDiv);
				
				if (group != "habitat_none") {
					var stats = this._data.stats.habitat[group];
					
					array.forEach(_.keys(stats), function(stat) {
						var color = (_.has(stats[stat], "color")) ? stats[stat].color : "#0096D6";
						
						var statDiv = domConstruct.create("div", {
							className: "stat next"
						}, containerDiv);
						
						domConstruct.create("div", {
							className: "number",
							style:"width:30%; color:" + color + ";",
							innerHTML: stats[stat].number
						}, statDiv);
						
						domConstruct.create("div", {
							className: "description",
							style:"width:70%",
							innerHTML: stats[stat].description
						}, statDiv);
					})
				}
				
			}
			
			this.loadJobsStats = function() {
				var group = query(".plugin-dac .toggle-btn.economics input[type=radio]:checked")[0].value;
				var stats = this._data.stats[this._region]["coastal-jobs"][group];
				
				var contentDiv = domConstruct.create("div", {
					className: "stats-div",
					style:"margin-top: 5px;"
				}, this.jobsStatsChartDiv);
				
				var containerDiv = domConstruct.create("div", {
					className: "stats-container coastal-jobs"
				}, contentDiv);
				
				var statDiv = domConstruct.create("div", {
					className: "stat total last"
				}, containerDiv);
				
				domConstruct.create("div", {
					className: "number",
					innerHTML: stats.total.number
				}, statDiv);
				
				domConstruct.create("div", {
					className: "description",
					innerHTML: stats.total.description
				}, statDiv);
				
				var statDiv = domConstruct.create("div", {
					className: "stat dac next"
				}, containerDiv);
				
				domConstruct.create("div", {
					className: "number",
					innerHTML: stats.dac.number
				}, statDiv);
				
				domConstruct.create("div", {
					className: "description",
					innerHTML: stats.dac.description
				}, statDiv);
				
			}
			
			this.updateJobsStats = function() {
				var group = query(".plugin-dac .toggle-btn.economics input[type=radio]:checked")[0].value;
				group = (group == "drive") ? "all_jobs" : group;
				var stats = this._data.stats[this._region]["coastal-jobs"][group];
				
				var totalNumber = query(".coastal-jobs .stat.total .number")[0];
				var totalDescription = query(".coastal-jobs .stat.total .description")[0];
				
				totalNumber.innerHTML = stats.total.number;
				totalDescription.innerHTML = stats.total.description;
				
				var dacNumber = query(".coastal-jobs .stat.dac .number")[0];
				var dacDescription = query(".coastal-jobs .stat.dac .description")[0];
				
				dacNumber.innerHTML = stats.dac.number;
				dacDescription.innerHTML = stats.dac.description;
				
			}
			
			this.loadJobsChart = function() {
				var contentDiv = domConstruct.create("div", {
					className: "chart-div",
				}, this.jobsStatsChartDiv);
				
				var chartDiv = domConstruct.create("div", {
					id: "chart-jobs"
				}, contentDiv);
				
				var group = query(".plugin-dac .toggle-btn.economics input[type=radio]:checked")[0].value;
				var data = this._data.stats[this._region]["coastal-jobs"][group].chart;
				
				data.columns = ["group", "total"];
				
				var fieldX = data.columns[0];
				var fieldY = data.columns[1];
				var xAxisRotate = 0;
				var xAxisAnchor = (xAxisRotate == 0) ? "middle" : "start";
				var yAxisTitle = "# of Coastal Jobs";
				var yAxisFormat = d3.format(".2s");
				
				var margin = {top: 20, right: 20, bottom: 30, left: 45}
				var width = 325;
				var height = 150;
				var padding = 0.45;
				
				var categories = _.pluck(data, fieldX);
				var values = _.pluck(data, fieldY);
				var x = d3.scale.ordinal()
					.rangeRoundBands([0, width],0.05, 0.0);
				
				var y = d3.scale.linear()
					.rangeRound([height, 0]);
				this._charts.jobs.y =  y;

				var min = d3.min(values);
				min = (min > 0) ? 0 : min;
				var max = d3.max(values);
				max = (max < 0) ? 0 : max;
				
				x.domain(categories);
				y.domain([min, max]).nice();
				
				var xAxis = d3.svg.axis()
					.scale(x)
					.orient("bottom");
					
				var yAxis = d3.svg.axis()
					.scale(y)
					.orient("left")
					.ticks(5);
				this._charts.jobs.yAxis = yAxis;
				
				var colors = ["#225EA8", "#7ECCBA", "#FFFFCC","#CDD6D5"];
				var z = d3.scale.ordinal()
					.range(colors);
				
				this._charts.jobs.chart = d3.select("#chart-jobs g.main");
				var chart = this._charts.jobs.chart;
    
				if (_.isNull(chart.node())) {
				chart = d3.select("#chart-jobs");
                chart.append("svg")
                    .attr("width", width + margin.left + margin.right)
                    .attr("height", height + margin.top + margin.bottom)
                    .append("g")
						.attr("class", "chart main")
						.attr("transform", "translate(" + margin.left + "," + margin.top + ")");
				}
				var legend = dom.byId("chart-jobs-legend"); 
				
				chart = d3.select("#chart-jobs g.main");
				chart.append("g")
					.attr("class", "axis--x")
					.attr("transform", "translate(0," + height + ")")
					.transition()
					.duration(500)
					.call(d3.svg.axis()
						.scale(x)
						.orient("bottom")
						.outerTickSize(0)
					)
					.selectAll(".tick text")
					.attr("text-anchor", xAxisAnchor)
					.attr("transform", "rotate(" + xAxisRotate + ")");
				
				chart.append("g")
					.attr("class", "axis--y")
					.transition()
					.duration(500)
					.call(d3.svg.axis()
						.scale(y)
						.orient("left")
						.ticks(5)
						.tickFormat(d3.format(".2s"))
						.innerTickSize(-width)
						.outerTickSize(0)
					)
					.selectAll(".tick text")
					.attr("dx", -2)
					.attr("dy", 3)
				
				chart.select("g.axis--y")
					.append("text")
					.attr("class", "axis-title")
					.attr("x", -75)
					.attr("y", -40)
					.attr("dy", "0.32em")
					.attr("text-anchor", "middle")
					.attr("transform", "rotate(-90)")
					.style("font-size", "13px")
					.style("font-weight", "500")
					.style("fill", "#666666")
					.text(yAxisTitle);

				
				domConstruct.create("div", {
					className: "pay-range",
					style:"position:absolute; top:197px; left:48px; color:#aaaaaa;",
					innerHTML:"<i class='fa fa-minus' style='margin-right: 27px;'></i><span style='background-color:#fafafa;padding: 5px;'>Low Earnings</span><i class='fa fa-minus' style='margin-left: 27px;'></i>"
				}, contentDiv);
				
				domConstruct.create("div", {
					className: "pay-range-line",
					style:"position:absolute; width:1px; border:1px solid #aaaaaa;  height: 12px; top:197px; left:46px;"
				}, contentDiv);
				
				domConstruct.create("div", {
					className: "pay-range-line",
					style:"position:absolute; width:1px; border:1px solid #aaaaaa; height: 12px; top:197px; left:209px;"
				}, contentDiv);
				
				
				chart.selectAll(".bar")
					.data(data)
					.enter().append("rect")
						.attr("class", "bar")
						.attr("x", function(d) { return x(d[fieldX]); })
						.attr("y", function(d) { return y(d[fieldY]); })
						.attr("fill", function(d) { var fill = z(d[fieldX]); return fill; })
						.attr("opacity", 0.25)
						.transition()
						.duration(500)
							.attr("y", function(d) { return y(d[fieldY]); })
							.attr("width", x.rangeBand())
							.attr("height", function(d) { var value = Math.abs(y(0) - y(d[fieldY])); return value; });
							
				chart.selectAll(".subbar")
					.data(data)
					.enter().append("rect")
						.attr("class", "subbar")
						.attr("x", function(d) { return x(d[fieldX]); })
						.attr("y", function(d) { return y(d["total"]); })
						.attr("fill", function(d) { var fill = z(d[fieldX]); return fill; })
						.transition()
						.duration(500)
							.attr("y", function(d) { return y(d[fieldY]); })
							.attr("width", x.rangeBand())
							.attr("height", function(d) { var value = Math.abs(y(0) - y(d[fieldY])); return value; });
					
			}
			
			this.updateJobsChart = function() {
				var region = this._region;
				var group = query(".plugin-dac .toggle-btn.economics input[type=radio]:checked")[0].value;
				var data = this._data.stats[this._region]["coastal-jobs"][group].chart;
				
				var width = 325;
				
				var chart = d3.select("#chart-jobs g.main");
				var y = this._charts.jobs.y;
				var yAxis = this._charts.jobs.yAxis;
				
				var min = 0;
				var max = d3.max(data.map(function(d) { return d.total ;}))
				
				y.domain([min, max]).nice();
				chart.select(".axis--y")
					.transition()
					.duration(500)
					.call(yAxis
						.scale(y)
						.orient("left")
						.ticks(5)
						.tickFormat(d3.format(".2s"))
						.innerTickSize(-width)
						.outerTickSize(0)
					)
					
				chart.select(".axis--y").selectAll(".tick text")
					.attr("dx", -2)
					.attr("dy", 3)
					
				chart.selectAll(".bar")
					.data(data)
					.transition()
					.duration(500)
						.attr("y", function(d) { return y(d["total"]); })
						.attr("height", function(d) { 
							var height = Math.abs(y(0) - y(d["total"]));
							return height;
						})
				
				chart.selectAll(".subbar")
					.data(data)
					.transition()
					.duration(500)
						.attr("y", function(d) {
							var value = (d["dac"] > 0) ? d["dac"] : d["total"];		
							return y(value);
						})
						.attr("height", function(d) { 
							var value = (d["dac"] > 0) ? d["dac"] : d["total"];	
							var height = Math.abs(y(0) - y(value));
							return height;
						})
			}
			
			this.loadDriveStats = function() {
				var stats = this._data.stats["Santa Monica"]["coastal-jobs"]["drive"];
				
				var contentDiv = domConstruct.create("div", {
					className: "stats-div",
					style:"margin-top: 5px;"
				}, this.jobsDriveDiv);
				
				var containerDiv = domConstruct.create("div", {
					className: "stats-container drive"
				}, contentDiv);
				
				var statDiv = domConstruct.create("div", {
					className: "stat stat_1 next"
				}, containerDiv);
				
				domConstruct.create("div", {
					className: "number",
					innerHTML: stats.stat_1.number
				}, statDiv);
				
				domConstruct.create("div", {
					className: "description",
					innerHTML: stats.stat_1.description
				}, statDiv);
				
				var statDiv = domConstruct.create("div", {
					className: "stat stat_2 last"
				}, containerDiv);
				
				domConstruct.create("div", {
					className: "number",
					innerHTML:stats.stat_2.number
				}, statDiv);
				
				domConstruct.create("div", {
					className: "description",
					innerHTML: stats.stat_2.description
				}, statDiv);
				
			}
			
			this.updateDriveStats = function() {
				var stats = this._data.stats[this._region]["coastal-jobs"]["drive"];
				
				var statNumber = query(".drive .stat.stat_1 .number")[0];
				var statDescription = query(".drive .stat.stat_1 .description")[0];
				
				statNumber.innerHTML = stats.stat_1.number;
				statDescription.innerHTML = stats.stat_1.description;
				
				var statNumber = query(".drive .stat.stat_2 .number")[0];
				var statDescription = query(".drive .stat.stat_2 .description")[0];
				
				statNumber.innerHTML = stats.stat_2.number;
				statDescription.innerHTML = stats.stat_2.description;
				
			}
			
			this.loadDriveChart = function() {
				var contentDiv = domConstruct.create("div", {
					className: "chart-div",
				}, this.jobsDriveDiv);
				
				var chartDiv = domConstruct.create("div", {
					id: "chart-drive"
				}, contentDiv);
				
				var data = this._data.stats["Santa Monica"]["coastal-jobs"]["drive"].chart;
				
				data.columns = ["group", "value"];
				
				var fieldX = data.columns[0];
				var fieldY = data.columns[1];
				var xAxisRotate = 0;
				var xAxisAnchor = (xAxisRotate == 0) ? "middle" : "start";
				var yAxisTitle = "# of Jobs";
				var yAxisFormat = d3.format(".2s");
				
				var margin = {top: 20, right: 20, bottom: 30, left: 45}
				var width = 325;
				var height = 150;
				var padding = 0.45;
				
				var categories = _.pluck(data, fieldX);
				var values = _.pluck(data, fieldY);
				var x = d3.scale.ordinal()
					.rangeRoundBands([0, width],0.05, 0.0);
				
				var y = d3.scale.linear()
					.rangeRound([height, 0]);
				this._charts.drive.y =  y;

				var min = d3.min(values);
				min = (min > 0) ? 0 : min;
				var max = d3.max(values);
				max = (max < 0) ? 0 : max;
				
				x.domain(categories);
				y.domain([min, max]).nice();
				
				var xAxis = d3.svg.axis()
					.scale(x)
					.orient("bottom");
					
				var yAxis = d3.svg.axis()
					.scale(y)
					.orient("left")
					.ticks(5);
				this._charts.drive.yAxis = yAxis;
				
				var colors = ["#225EA8", "#7ECCBA", "#FFFFCC","#CDD6D5"];
				var z = d3.scale.ordinal()
					.range(colors);
				
				this._charts.drive.chart = d3.select("#chart-drive g.main");
				var chart = this._charts.drive.chart;
    
				if (_.isNull(chart.node())) {
				chart = d3.select("#chart-drive");
                chart.append("svg")
                    .attr("width", width + margin.left + margin.right)
                    .attr("height", height + margin.top + margin.bottom)
                    .append("g")
						.attr("class", "chart main")
						.attr("transform", "translate(" + margin.left + "," + margin.top + ")");
				}
				var legend = dom.byId("chart-drive-legend"); 
				
				chart = d3.select("#chart-drive g.main");
				chart.append("g")
					.attr("class", "axis--x")
					.attr("transform", "translate(0," + height + ")")
					.transition()
					.duration(500)
					.call(d3.svg.axis()
						.scale(x)
						.orient("bottom")
						.outerTickSize(0)
					)
					.selectAll(".tick text")
					.attr("text-anchor", xAxisAnchor)
					.attr("transform", "rotate(" + xAxisRotate + ")");
				
				chart.append("g")
					.attr("class", "axis--y")
					.transition()
					.duration(500)
					.call(d3.svg.axis()
						.scale(y)
						.orient("left")
						.ticks(5)
						.tickFormat(d3.format(".2s"))
						.innerTickSize(-width)
						.outerTickSize(0)
					)
					.selectAll(".tick text")
					.attr("dx", -2)
					.attr("dy", 3)
				
				chart.select("g.axis--y")
					.append("text")
					.attr("class", "axis-title")
					.attr("x", -75)
					.attr("y", -40)
					.attr("dy", "0.32em")
					.attr("text-anchor", "middle")
					.attr("transform", "rotate(-90)")
					.style("font-size", "13px")
					.style("font-weight", "500")
					.style("fill", "#666666")
					.text(yAxisTitle);
				
				chart.selectAll(".bar")
					.data(data)
					.enter().append("rect")
						.attr("class", "bar")
						.attr("x", function(d) { return x(d[fieldX]); })
						.attr("y", function(d) { return y(d[fieldY]); })
						.attr("fill", function(d) { var fill = z(d[fieldX]); return fill; })
						.attr("opacity", 1)
						.transition()
						.duration(500)
							.attr("y", function(d) { return y(d[fieldY]); })
							.attr("width", x.rangeBand())
							.attr("height", function(d) { var value = Math.abs(y(0) - y(d[fieldY])); return value; });
			}

			this.updateDriveChart = function() {
				var region = this._region;
				var data = this._data.stats[this._region]["coastal-jobs"]["drive"].chart;
				
				var width = 325;
				
				var chart = d3.select("#chart-drive g.main");
				var y = this._charts.drive.y;
				var yAxis = this._charts.drive.yAxis;
				
				var min = 0;
				var max = d3.max(data.map(function(d) { return d.value ;}))
				
				y.domain([min, max]).nice();
				chart.select(".axis--y")
					.transition()
					.duration(500)
					.call(yAxis
						.scale(y)
						.orient("left")
						.ticks(5)
						.tickFormat(d3.format(".2s"))
						.innerTickSize(-width)
						.outerTickSize(0)
					)
					
				chart.select(".axis--y").selectAll(".tick text")
					.attr("dx", -2)
					.attr("dy", 3)
					
				chart.selectAll(".bar")
					.data(data)
					.transition()
					.duration(500)
						.attr("y", function(d) { return y(d.value); })
						.attr("height", function(d) { 
							var height = Math.abs(y(0) - y(d.value));
							return height;
						})
			}	
			
			this.loadAccessStats = function() {
				
				var contentDiv = domConstruct.create("div", {
					className: "stats-div",
					style:"margin-top: 5px;"
				}, this.accessStatsDiv);
				
				var containerDiv = domConstruct.create("div", {
					className: "stats-container access"
				}, contentDiv);
				
				var statDiv = domConstruct.create("div", {
					className: "stat dac next"
				}, containerDiv);
				
				domConstruct.create("div", {
					className: "number",
					style: "width:25%;",
					innerHTML: "$63 K"
				}, statDiv);
				
				domConstruct.create("div", {
					className: "description",
					style: "width:75%;",
					innerHTML: "is the average household median income of census tracts in the county"
				}, statDiv);
				
				var statDiv = domConstruct.create("div", {
					className: "stat total last"
				}, containerDiv);
				
				domConstruct.create("div", {
					className: "number",
					style: "width:25%;",
					innerHTML: "14 mi"
				}, statDiv);
				
				domConstruct.create("div", {
					className: "description",
					style: "width:75%;",
					innerHTML: "is the average distance between census tracts and the nearest coastal access"
				}, statDiv);
				
			}
			
			this.loadDacJobsStats = function() {
				
				var stats = this._data.stats[this._region]["dac-jobs"]["dac"];
				
				var contentDiv = domConstruct.create("div", {
					className: "stats-div",
					style:"margin-top: 5px;"
				}, this.dacJobsStatsChartDiv);
				
				var containerDiv = domConstruct.create("div", {
					className: "stats-container"
				}, contentDiv);
				
				var statDiv = domConstruct.create("div", {
					className: "stat last"
				}, containerDiv);
				
				domConstruct.create("div", {
					className: "number",
					innerHTML: stats.total.number
				}, statDiv);
				
				domConstruct.create("div", {
					className: "description",
					innerHTML: stats.total.description
				}, statDiv);
				
				var statDiv = domConstruct.create("div", {
					className: "stat next"
				}, containerDiv);
				
				domConstruct.create("div", {
					className: "number",
					innerHTML: stats.dac.number
				}, statDiv);
				
				domConstruct.create("div", {
					className: "description",
					innerHTML: stats.dac.description
				}, statDiv);
				
			}
			
			this.loadDacJobsChart = function() {
				var contentDiv = domConstruct.create("div", {
					className: "chart-div",
				}, this.dacJobsStatsChartDiv);
				
				var chartDiv = domConstruct.create("div", {
					id: "chart-dac-jobs"
				}, contentDiv);
				
				var data = [
					{"Group":"<= $1,250","Value":473759},
					{"Group":"$1,251 - $3,333","Value":717401},
					{"Group":"> $3,333","Value":522230},
					{"Group":"Total","Value":1713390}
				];
				data.columns = ["Group","Value"];
				
				var fieldX = data.columns[0];
				var fieldY = data.columns[1];
				var xAxisRotate = 0;
				var xAxisAnchor = (xAxisRotate == 0) ? "middle" : "start";
				var yAxisTitle = "# of Jobs";
				var yAxisFormat = d3.format(".2s");
				
				var margin = {top: 20, right: 20, bottom: 30, left: 45}
				var width = 325;
				var height = 150;
				var padding = 0.45;
				
				var categories = _.pluck(data, fieldX);
				var values = _.pluck(data, fieldY);
				var x = d3.scale.ordinal()
					.rangeRoundBands([0, width],0.05, 0.0);
				
				var y = d3.scale.linear()
					.rangeRound([height, 0]);

				var min = d3.min(values);
				min = (min > 0) ? 0 : min;
				var max = d3.max(values);
				max = (max < 0) ? 0 : max + 190000;
				
				x.domain(categories);
				y.domain([min, max]).nice();
				
				var xAxis = d3.svg.axis()
					.scale(x)
					.orient("bottom");
					
				var yAxis = d3.svg.axis()
					.scale(y)
					.orient("left")
					.ticks(5);
				
				var colors = ["#225EA8", "#7ECCBA", "#FFFFCC","#CDD6D5"];
				var z = d3.scale.ordinal()
					.range(colors);
				
				this._charts.dacJobs.chart = d3.select("#chart-dac-jobs g.main");
    
				if (_.isNull(this._charts.dacJobs.chart.node())) {
				this._charts.dacJobs.chart = d3.select("#chart-dac-jobs");
                this._charts.dacJobs.chart.append("svg")
                    .attr("width", width + margin.left + margin.right)
                    .attr("height", height + margin.top + margin.bottom)
                    .append("g")
						.attr("class", "chart main")
						.attr("transform", "translate(" + margin.left + "," + margin.top + ")");
				}
				var legend = dom.byId("chart-dac-jobs-legend"); 
				
				this._charts.dacJobs.chart = d3.select("#chart-dac-jobs g.main");
				this._charts.dacJobs.chart.append("g")
					.attr("class", "axis--x")
					.attr("transform", "translate(0," + height + ")")
					.transition()
					.duration(500)
					.call(d3.svg.axis()
						.scale(x)
						.orient("bottom")
						.outerTickSize(0)
					)
					.selectAll(".tick text")
					.attr("text-anchor", xAxisAnchor)
					.attr("transform", "rotate(" + xAxisRotate + ")");
				
				this._charts.dacJobs.chart.append("g")
					.attr("class", "axis--y")
					.transition()
					.duration(500)
					.call(d3.svg.axis()
						.scale(y)
						.orient("left")
						.ticks(5)
						.tickFormat(d3.format(".2s"))
						.innerTickSize(-width)
						.outerTickSize(0)
					)
					.selectAll(".tick text")
					.attr("dx", -2)
					.attr("dy", 3)
				
				this._charts.dacJobs.chart.select("g.axis--y")
					.append("text")
					.attr("class", "axis-title")
					.attr("x", -80)
					.attr("y", -40)
					.attr("dy", "0.32em")
					.attr("text-anchor", "middle")
					.attr("transform", "rotate(-90)")
					.style("font-size", "13px")
					.style("font-weight", "500")
					.style("fill", "#666666")
					.text(yAxisTitle);
					
				domConstruct.create("div", {
					className: "pay-range",
					style:"position:absolute; top:197px; left:48px; color:#aaaaaa;",
					innerHTML:"<i class='fa fa-minus' style='margin-right: 27px;'></i><span style='background-color:#fafafa;padding: 5px;'>Low Earnings</span><i class='fa fa-minus' style='margin-left: 27px;'></i>"
				}, contentDiv);
				
				domConstruct.create("div", {
					className: "pay-range-line",
					style:"position:absolute; width:1px; border:1px solid #aaaaaa;  height: 12px; top:197px; left:46px;"
				}, contentDiv);
				
				domConstruct.create("div", {
					className: "pay-range-line",
					style:"position:absolute; width:1px; border:1px solid #aaaaaa; height: 12px; top:197px; left:209px;"
				}, contentDiv);
				
				this._charts.dacJobs.chart.selectAll(".bar")
					.data(data)
					.enter().append("rect")
						.attr("class", "bar")
						.attr("x", function(d) { return x(d[fieldX]); })
						.attr("y", function(d) { return y(d[fieldY]); })
						.attr("opacity", 0)
						.attr("fill", function(d) { var fill = z(d[fieldX]); return fill; })
						.transition()
						.duration(500)
							.attr("y", function(d) { return y(d[fieldY]); })
							.attr("width", x.rangeBand())
							.attr("height", function(d) { var value = Math.abs(y(0) - y(d[fieldY])); value = (value == 0) ? 1 : value; return value; })
							.attr("opacity", 1);
					
					
					var items = data.columns.slice(1);
			}
			
			
			this.loadDacEnvironmentStats = function() {
				var region = "Los Angeles County";
				var group = query(".plugin-dac .toggle-btn.enviro input[type=radio]:checked")[0].value;
				var stats = this._data.stats[region]["dac-environment"][group];
				
				var contentDiv = domConstruct.create("div", {
					className: "stats-div",
					style:"margin-top: 5px;"
				}, this.dacEnvironmentStatsDiv);
				
				var containerDiv = domConstruct.create("div", {
					className: "stats-container dac-environment"
				}, contentDiv);
				
				var defDiv = domConstruct.create("div", {
					className: "definition",
					style:"padding: 0px 20px 15px 20px;color:#777777",
					innerHTML: stats.definition
				}, containerDiv);
				
				var statDiv = domConstruct.create("div", {
					className: "stat stat_1 next"
				}, containerDiv);
				
				domConstruct.create("div", {
					className: "number",
					innerHTML: stats.stat_1.number
				}, statDiv);
				
				domConstruct.create("div", {
					className: "description",
					innerHTML: stats.stat_1.description
				}, statDiv);
				
				var statDiv = domConstruct.create("div", {
					className: "stat stat_2 last"
				}, containerDiv);
				
				domConstruct.create("div", {
					className: "number",
					innerHTML:stats.stat_2.number
				}, statDiv);
				
				domConstruct.create("div", {
					className: "description",
					innerHTML: stats.stat_2.description
				}, statDiv);
				
			}
			
			this.updateDacEnvironmentStats = function() {
				var region = "Los Angeles County";
				var group = query(".plugin-dac .toggle-btn.enviro input[type=radio]:checked")[0].value;
				var stats = this._data.stats[region]["dac-environment"][group];
				
				var statDefinition = query(".dac-environment .definition")[0];
				statDefinition.innerHTML = stats.definition;
				
				var statNumber = query(".dac-environment .stat.stat_1 .number")[0];
				var statDescription = query(".dac-environment .stat.stat_1 .description")[0];
				
				statNumber.innerHTML = stats.stat_1.number;
				statDescription.innerHTML = stats.stat_1.description;
				
				var statNumber = query(".dac-environment .stat.stat_2 .number")[0];
				var statDescription = query(".dac-environment .stat.stat_2 .description")[0];
				
				statNumber.innerHTML = stats.stat_2.number;
				statDescription.innerHTML = stats.stat_2.description;
				
			}

			this.showMessageDialog = function(node, message, position, orientation) {
				var orientation = (_.isUndefined(orientation)) ? "top" : orientation;
				self.tip.innerHTML = message;
				domStyle.set(self.tip, { "display": "block" });
				var offset = 3;
				
				var p = domGeom.position(win.body());
				var np = domGeom.position(node);
				var nm = domGeom.getMarginBox(node);
				var t = domGeom.getMarginBox(self.tip);
				var n = { "x": np.x, "y": np.y, "w": np.w, "h": (np.h == nm.h) ? np.h - 4 : np.h }
				
				switch (orientation) {
					case "top":
						var left = n.x - p.x - t.w/2 + n.w/2;
						var top = n.y - p.y - t.h - n.h + offset;
						left = (position && position.l) ? n.x - p.x - t.w/2 + position.l : left;
						top = (position && position.t) ? n.y - p.y - t.h - position.t : top;
						break;
						
					case "right":
						var left = n.x - p.x + 1.5*n.w + offset;
						var top = n.y - p.y - t.h/2 + n.h/2;
						left = (position && position.l) ? n.x - p.x + position.l : left;
						top = (position && position.t) ? n.y - p.y - t.h/2 + position.t : top;
						break;
						
					case "bottom":
						var left = n.x - p.x - t.w/2 + n.w/2;
						var top = n.y - p.y + 2*n.h + offset;
						left = (position && position.l) ? n.x - p.x - t.w/2 + position.l : left;
						top = (position && position.t) ? n.y - p.y + position.t : top;
						break;
					
					case "left":
						var left = n.x - p.x - t.w - n.w/2 - offset;
						var top = n.y - p.y - t.h/2 + n.h/2;
						left = (position && position.l) ? n.x - p.x - t.w - position.l : left;
						top = (position && position.t) ? n.y - p.y - t.h/2 + position.t : top;
						break;
				}
				domClass.remove(self.tip, ["tooltip-top","tooltip-left","tooltip-bottom","tooltip-right"]);
				domClass.add(self.tip, "tooltip-" + orientation);
				domStyle.set(self.tip, {
					"left": left + "px",
					"top": top + "px"
				});
				
				self.tip.focus();
            }

            this.hideMessageDialog = function() {
        		domStyle.set(self.tip, { "display": "none" });
			}
			
			this.identifyBlock = function(pt) {
				this._map.infoWindow.hide();
				this._map.graphics.clear();
				var layer = this._mapLayer;
				if (layer.id.indexOf("_blocks") >= 0) {
					var url = layer.url + "/" + layer.visibleLayers[0];
					var fields = this._interface.layers[layer.id].fields;
					
					var query = new Query();
					query.geometry = pt;
					query.spatialRelationship = Query.SPATIAL_REL_INTERSECTS;
					query.returnGeometry = true;
					query.outFields = fields;
					
					var queryTask = new QueryTask(url);
					queryTask.execute(query, function(response) {
						if (response.features.length > 0) {
							var graphic = response.features[0];
							var attributes = graphic.attributes;
							var pt = graphic.geometry.getCentroid();
							self._map.infoWindow.setFeatures([graphic]);
							
							var content = "<table class='jobsPopupTable' style='border-collapse:collapse;'>";
							content += "<tr><td style='text-align:center; font-weight:bold;border-bottom:1px solid #cccccc;padding:5px;' colspan=2># of Jobs by Earnings Category</td></tr>";
							content += "<tr style='background:#efefef;'><td style='text-align:right;padding:5px;width:60%;'><b>&lt; $1250</b>:</td><td style='text-align:left;padding:5px;'>" + d3.format(",.0f")(attributes[fields[0]]) + "</td></tr>";
							content += "<tr style='background:#ffffff;'><td style='text-align:right;padding:5px;width:60%;'><b>$1250 - $3333</b>:</td><td style='text-align:left;padding:5px;'>" + d3.format(",.0f")(attributes[fields[1]]) + "</td></tr>";
							content += "<tr style='background:#efefef;'><td style='text-align:right;padding:5px;width:60%;'><b>&gt; $3333</b>:</td><td style='text-align:left;padding:5px;'>" + d3.format(",.0f")(attributes[fields[2]]) + "</td></tr>";
							content += "<tr><td style='text-align:right;padding:5px;width:60%;border-top:1px solid #cccccc;'><b>Total</b>:</td><td style='text-align:left;padding:5px;border-top:1px solid #cccccc;'>" + d3.format(",.0f")(attributes[fields[3]]) + "</td></tr>";
							content += "</table>";
							
							self._map.infoWindow.setTitle("");
							self._map.infoWindow.setContent(content);
							self._map.infoWindow.show(pt);
						}
						
					});
				}
			}


		};
		
		return dacTool;	
		
	} //end anonymous function

); //End define
