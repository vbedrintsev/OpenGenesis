/**
 * Copyright (c) 2010-2012 Grid Dynamics Consulting Services, Inc, All Rights Reserved
 *   http://www.griddynamics.com
 *
 *   This library is free software; you can redistribute it and/or modify it under the terms of
 *   the GNU Lesser General Public License as published by the Free Software Foundation; either
 *   version 2.1 of the License, or any later version.
 *
 *   THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 *   AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 *   IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 *   DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE
 *   FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 *   DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 *   SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 *   CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 *   OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 *   OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 *   @Project:     Genesis
 *   @Description: Execution Workflow Engine
 */
package com.griddynamics.genesis.client;


import org.apache.http.auth.AuthScope;
import org.apache.http.auth.Credentials;
import org.apache.http.auth.UsernamePasswordCredentials;
import org.apache.http.impl.client.DefaultHttpClient;

import org.jboss.resteasy.client.ClientExecutor;
import org.jboss.resteasy.client.ProxyFactory;
import org.jboss.resteasy.client.core.executors.ApacheHttpClient4Executor;
import org.jboss.resteasy.plugins.providers.RegisterBuiltin;
import org.jboss.resteasy.spi.ResteasyProviderFactory;

import java.util.HashMap;
import java.util.Map;

/**
 * @author Victor Galkin
 */
public class ClientResorceGenericWrapper implements GenesisClient {

    ClientResourceGeneric client;

    public ClientResorceGenericWrapper(String server, String user, String password) {
        ResteasyProviderFactory providerFactory = ResteasyProviderFactory.getInstance();
        providerFactory.addMessageBodyReader(new ClientMessageBodyReader());

        RegisterBuiltin.register(providerFactory);

        DefaultHttpClient httpClient = new DefaultHttpClient();

        if (!((user == null) && (password == null))) {
            if (user == null) user = "";
            if (password == null) user = "";
            Credentials credentials = new UsernamePasswordCredentials(user, password);
            httpClient.getCredentialsProvider().setCredentials(AuthScope.ANY, credentials);
//            httpClient.getCredentialsProvider().setAuthenticationPreemptive(true);
        }

        ClientExecutor clientExecutor = new ApacheHttpClient4Executor(httpClient);

        client = ProxyFactory.create(ClientResourceGeneric.class, server, clientExecutor);
    }


    @Override
    public String signin(String user, String password) {
        return client.signin(user, password);
    }

    @Override
    public String listEnvs() {
        return client.listEnvs();
    }

    @Override
    public String describeEnv(String envName) {
        return client.describeEnv(envName);
    }

    @Override
    public String listTemplates() {
        return client.listTemplates();
    }

    @Override
    public String createEnv(String envName,
                            String creator,
                            String templateName,
                            String templateVersion,
                            Map<String, String> variables) {
        return client.createEnv(makeCreateEnvParams(envName,
                creator,
                templateName,
                templateVersion,
                variables));
    }


    @Override
    public String destroyEnv(String envName) {
        return client.destroyEnv(envName);
    }

    @Override
    public String requestWorkflow(String envName, String workflowName, Map<String, String> variables) {
        return client.requestWorkflow(envName, workflowName, makeRequestWorkflowParams(variables));
    }

    @Override
    public String cancelWorkflow(String envName) {
        return client.cancelWorkflow(envName);
    }

    private Map<String, Object> makeCreateEnvParams(String envName,
                                                    String creator,
                                                    String templateName,
                                                    String templateVersion,
                                                    Map<String, String> variables) {
        Map<String, Object> params = new HashMap<String, Object>();
        params.put("envName", envName);
        params.put("creator", creator);
        params.put("templateName", templateName);
        params.put("templateVersion", templateVersion);
        params.put("variables", variables);
        return params;
    }

    private Map<String, Object> makeRequestWorkflowParams(Map<String, String> variables) {

        Map<String, Object> params = new HashMap<String, Object>();
        params.put("variables", variables);
        return params;
    }

    private Map<String, Object> makeDestroyEnvParams(Map<String, String> variables) {

        Map<String, Object> params = new HashMap<String, Object>();
        params.put("variables", variables);
        return params;
    }
}
