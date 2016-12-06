import { injectable, inject } from 'inversify';
import { ServiceIdentifiers } from '../../../container/ServiceIdentifiers';

import { TCustomNodeFactory } from '../../../types/container/TCustomNodeFactory';
import { TNodeWithBlockStatement } from '../../../types/node/TNodeWithBlockStatement';

import { ICustomNode } from '../../../interfaces/custom-nodes/ICustomNode';
import { IObfuscationEventEmitter } from '../../../interfaces/event-emitters/IObfuscationEventEmitter';
import { IOptions } from '../../../interfaces/options/IOptions';
import { IStackTraceData } from '../../../interfaces/stack-trace-analyzer/IStackTraceData';

import { initializable } from '../../../decorators/Initializable';

import { CustomNodes } from '../../../enums/container/CustomNodes';

import { AbstractCustomNodeGroup } from '../../AbstractCustomNodeGroup';
import { NodeAppender } from '../../../node/NodeAppender';
import { Utils } from '../../../Utils';

@injectable()
export class DomainLockCustomNodeGroup extends AbstractCustomNodeGroup {
    /**
     * @type {TCustomNodeFactory}
     */
    private readonly customNodeFactory: TCustomNodeFactory;

    /**
     * @type {Map<string, ICustomNode>}
     */
    @initializable()
    protected customNodes: Map <string, ICustomNode>;

    /**
     * @type {string}
     */
    protected readonly groupName: string = 'domainLockCustomNodeGroup';

    /**
     * @type {IObfuscationEventEmitter}
     */
    private readonly obfuscationEventEmitter: IObfuscationEventEmitter;

    /**
     * @param customNodeFactory
     * @param obfuscationEventEmitter
     * @param options
     */
    constructor (
        @inject(ServiceIdentifiers['Factory<ICustomNode>']) customNodeFactory: TCustomNodeFactory,
        @inject(ServiceIdentifiers.IObfuscationEventEmitter) obfuscationEventEmitter: IObfuscationEventEmitter,
        @inject(ServiceIdentifiers.IOptions) options: IOptions
    ) {
        super(options);

        this.customNodeFactory = customNodeFactory;
        this.obfuscationEventEmitter = obfuscationEventEmitter;
    }

    /**
     * @param stackTraceData
     */
    public initialize (stackTraceData: IStackTraceData[]): void {
        const callsControllerFunctionName: string = Utils.getRandomVariableName();
        const randomStackTraceIndex: number = NodeAppender.getRandomStackTraceIndex(stackTraceData.length);

        const domainLockNode: ICustomNode = this.customNodeFactory(CustomNodes.DomainLockNode);
        const nodeCallsControllerFunctionNode: ICustomNode = this.customNodeFactory(CustomNodes.NodeCallsControllerFunctionNode);

        domainLockNode.initialize(callsControllerFunctionName);
        nodeCallsControllerFunctionNode.initialize(this.appendEvent, callsControllerFunctionName);

        this.customNodes = new Map <string, ICustomNode> ([
            ['domainLockNode', domainLockNode],
            ['nodeCallsControllerFunctionNode', nodeCallsControllerFunctionNode]
        ]);

        if (!this.options.domainLock.length) {
            return;
        }

        this.obfuscationEventEmitter.once(
            this.appendEvent,
            (blockScopeNode: TNodeWithBlockStatement, stackTraceData: IStackTraceData[]) => {
                // domainLockNode append
                NodeAppender.appendNodeToOptimalBlockScope(
                    stackTraceData,
                    blockScopeNode,
                    domainLockNode.getNode(),
                    randomStackTraceIndex
                );

                // nodeCallsControllerFunctionNode append
                let targetBlockScope: TNodeWithBlockStatement;

                if (stackTraceData.length) {
                    targetBlockScope = NodeAppender
                        .getOptimalBlockScope(stackTraceData, randomStackTraceIndex, 1);
                } else {
                    targetBlockScope = blockScopeNode;
                }

                NodeAppender.prependNode(targetBlockScope, nodeCallsControllerFunctionNode.getNode());
            }
        );
    }
}
